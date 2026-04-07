import ast
import io
import math
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from contextlib import redirect_stdout
from typing import Any, Dict, List, Optional, TypedDict

import numpy as np
import pandas as pd
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from config.settings import settings


class InsightPlan(BaseModel):
    requires_code_execution: bool = Field(
        default=False,
        description="Whether answering this query needs code execution over the dataframe.",
    )
    python_code: str = Field(
        default="",
        description="Valid Python code that reads from df and assigns final answer payload to `result`.",
    )
    reasoning: str = Field(default="")


class InsightState(TypedDict, total=False):
    df: Any
    query: str
    history: List[Dict[str, str]]
    dataset_profile: str
    plan: InsightPlan
    execution_output: str
    response: str


class InsightAgent:
    def __init__(self):
        if settings.gemini_api_key:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=settings.gemini_api_key,
                temperature=0.2,
            )
        else:
            self.llm = None
        self._graph = self._build_graph()

    def _prepare_context(self, df: pd.DataFrame) -> str:
        shape = df.shape
        columns = df.columns.tolist()
        dtypes = df.dtypes.astype(str).to_dict()
        missing = df.isnull().sum().to_dict()
        sample = df.head(8).to_dict(orient="records")

        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
        numeric_summary = {}
        if numeric_cols:
            summary_df = df[numeric_cols].describe().transpose()
            numeric_summary = summary_df.to_dict(orient="index")

        return (
            f"Dataset shape: {shape}\n"
            f"Columns: {columns}\n"
            f"Dtypes: {dtypes}\n"
            f"Missing values: {missing}\n"
            f"Numeric summary: {numeric_summary}\n"
            f"Sample rows: {sample}"
        )

    def _build_graph(self):
        workflow = StateGraph(InsightState)
        workflow.add_node("plan", self._plan_node)
        workflow.add_node("execute", self._execute_node)
        workflow.add_node("respond", self._respond_node)

        workflow.set_entry_point("plan")
        workflow.add_conditional_edges(
            "plan",
            self._route_after_plan,
            {
                "execute": "execute",
                "respond": "respond",
            },
        )
        workflow.add_edge("execute", "respond")
        workflow.add_edge("respond", END)
        return workflow.compile()

    def _route_after_plan(self, state: InsightState) -> str:
        plan = state.get("plan")
        if plan and plan.requires_code_execution:
            return "execute"
        return "respond"

    def _plan_node(self, state: InsightState) -> InsightState:
        if not self.llm:
            return {
                "plan": InsightPlan(
                    requires_code_execution=False,
                    reasoning="No LLM key configured; fallback response mode.",
                )
            }

        history_text = "\n".join(
            [f"{m.get('role', 'user')}: {m.get('content', '')}" for m in state.get("history", [])[-8:]]
        )

        planner_prompt = f"""
You are a planning agent for dataframe analytics.

You must decide if Python execution over `df` is needed to answer the user.

Rules:
- If the user asks for concrete calculations, comparisons, filters, grouped metrics, outliers, tests, or transformations, set requires_code_execution=true.
- If asking for generic explanation from already-provided profile, code execution can be false.
- If code is needed, produce safe code using only pandas/numpy/math and `df`.
- Always assign the final payload to variable `result`.
- Do not use file/network/system operations.

Dataset profile:
{state.get("dataset_profile", "")}

Conversation history:
{history_text}

User query:
{state.get("query", "")}
"""

        planner = self.llm.with_structured_output(InsightPlan)
        plan = planner.invoke(planner_prompt)
        return {"plan": plan}

    def _validate_code(self, code: str):
        tree = ast.parse(code)
        forbidden_nodes = (ast.Import, ast.ImportFrom, ast.With, ast.AsyncWith, ast.Lambda)
        forbidden_names = {"exec", "eval", "open", "__import__", "compile", "input"}

        for node in ast.walk(tree):
            if isinstance(node, forbidden_nodes):
                raise ValueError("Unsupported Python construct detected in generated code.")
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in forbidden_names:
                raise ValueError("Unsafe function usage detected in generated code.")
            if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
                raise ValueError("Dunder attribute access is not allowed in generated code.")

    def _execute_dataframe_code(self, df: pd.DataFrame, code: str) -> str:
        self._validate_code(code)
        safe_builtins = {
            "len": len,
            "sum": sum,
            "min": min,
            "max": max,
            "abs": abs,
            "round": round,
            "sorted": sorted,
            "range": range,
            "enumerate": enumerate,
        }
        local_vars: Dict[str, Any] = {
            "df": df.copy(),
            "pd": pd,
            "np": np,
            "math": math,
            "result": None,
        }

        stdout_buffer = io.StringIO()
        with redirect_stdout(stdout_buffer):
            exec(code, {"__builtins__": safe_builtins}, local_vars)

        result_payload = local_vars.get("result")
        if result_payload is None:
            raise ValueError("Generated code did not assign output to `result`.")

        stdout_text = stdout_buffer.getvalue().strip()
        if stdout_text:
            return f"Computed result: {result_payload}\nCaptured output: {stdout_text}"
        return f"Computed result: {result_payload}"

    def _execute_node(self, state: InsightState) -> InsightState:
        plan = state.get("plan")
        if not plan or not plan.python_code.strip():
            return {"execution_output": "No execution was required."}

        df = state.get("df")
        if df is None:
            return {"execution_output": "Execution skipped because dataframe is unavailable."}

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(self._execute_dataframe_code, df, plan.python_code)
            try:
                output = future.result(timeout=8)
                return {"execution_output": output}
            except FuturesTimeoutError:
                return {"execution_output": "Execution timed out after 8 seconds."}
            except Exception as exc:
                return {"execution_output": f"Execution failed: {str(exc)}"}

    def _respond_node(self, state: InsightState) -> InsightState:
        if not self.llm:
            fallback = (
                "AI insight agent is not configured because `gemini_api_key` is missing. "
                "Set it in your .env file to enable interactive analysis."
            )
            return {"response": fallback}

        plan = state.get("plan")
        execution_output = state.get("execution_output", "No code execution output.")
        history_text = "\n".join(
            [f"{m.get('role', 'user')}: {m.get('content', '')}" for m in state.get("history", [])[-8:]]
        )

        response_prompt = f"""
You are an expert data analyst chatbot.

Answer using the dataset profile and execution outputs when available.
Be precise, mention column names, include computed evidence when possible, and avoid generic advice.

Dataset profile:
{state.get("dataset_profile", "")}

Plan reasoning:
{plan.reasoning if plan else "N/A"}

Execution output:
{execution_output}

Conversation history:
{history_text}

User query:
{state.get("query", "")}
"""

        response = self.llm.invoke(response_prompt)
        if hasattr(response, "content"):
            return {"response": str(response.content)}
        return {"response": str(response)}

    def _run_graph(
        self,
        df: pd.DataFrame,
        user_query: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        dataset_profile = self._prepare_context(df)

        initial_state: InsightState = {
            "df": df,
            "query": user_query,
            "history": history or [],
            "dataset_profile": dataset_profile,
        }
        final_state = self._graph.invoke(initial_state)
        return final_state.get("response", "I could not generate a response.")

    def chat(
        self,
        df: pd.DataFrame,
        user_query: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        return self._run_graph(df=df, user_query=user_query, history=history)

    def generate_insight(self, df: pd.DataFrame, user_query: str = "") -> str:
        return self.chat(df=df, user_query=user_query, history=[])