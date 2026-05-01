from __future__ import annotations

import io
import pickle
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LinearRegression, LogisticRegression, ElasticNet
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.svm import SVR, SVC
from sklearn.neighbors import KNeighborsRegressor, KNeighborsClassifier
from sklearn.metrics import (
    mean_squared_error,
    r2_score,
    mean_absolute_error,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)

try:
    from xgboost import XGBRegressor, XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

from langchain_google_genai import ChatGoogleGenerativeAI
from config.settings import settings


class ModelTrainingAgent:
    REGRESSION_MODELS = {
        "linear_regression": LinearRegression,
        "elastic_net": ElasticNet,
        "random_forest": RandomForestRegressor,
        "decision_tree": DecisionTreeRegressor,
        "svm": SVR,
        "knn": KNeighborsRegressor,
    }
    
    CLASSIFICATION_MODELS = {
        "logistic_regression": LogisticRegression,
        "random_forest": RandomForestClassifier,
        "decision_tree": DecisionTreeClassifier,
        "svm": SVC,
        "knn": KNeighborsClassifier,
    }
    
    if HAS_XGBOOST:
        REGRESSION_MODELS["xgboost"] = XGBRegressor
        CLASSIFICATION_MODELS["xgboost"] = XGBClassifier

    def __init__(self):
        if settings.gemini_api_key:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=settings.gemini_api_key,
                temperature=0.3,
            )
        else:
            self.llm = None

    def _get_numeric_columns(self, df: pd.DataFrame) -> List[str]:
        """Get all numeric columns."""
        return df.select_dtypes(include=["number"]).columns.tolist()

    def _infer_task_type(self, df: pd.DataFrame, target_col: str) -> str:
        """Infer if task is regression or classification based on target column."""
        if df[target_col].dtype in ["object", "category", "bool"]:
            return "classification"
        
        unique_values = df[target_col].nunique()
        if unique_values < 20:
            return "classification"
        return "regression"

    def _calculate_data_quality_score(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate data quality metrics."""
        numeric_cols = self._get_numeric_columns(df)
        
        # Null rate
        total_nulls = df.isna().sum().sum()
        total_cells = df.shape[0] * df.shape[1]
        null_rate = (total_nulls / total_cells) * 100 if total_cells else 0
        
        # Outlier detection (IQR)
        outlier_rate = 0.0
        outlier_count = 0
        for col in numeric_cols:
            series = df[col].dropna()
            if len(series) < 4:
                continue
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            count = int(((series < lower) | (series > upper)).sum())
            outlier_count += count
        
        outlier_rate = (outlier_count / (df.shape[0] * len(numeric_cols))) * 100 if numeric_cols else 0
        
        # Data completeness
        completeness = 100 - null_rate
        
        # Feature diversity
        categorical_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        feature_diversity = (len(numeric_cols) + len(categorical_cols)) / df.shape[1] * 100
        
        # Class balance (for classification datasets)
        class_balance_score = 80.0  # default
        
        return {
            "null_rate": round(null_rate, 2),
            "outlier_rate": round(outlier_rate, 2),
            "completeness": round(completeness, 2),
            "feature_diversity": round(feature_diversity, 2),
            "class_balance_score": class_balance_score,
        }

    def _recommend_models(self, df: pd.DataFrame, target_col: str, task_type: str) -> List[Dict[str, Any]]:
        """Recommend models based on data quality and dataset characteristics."""
        quality = self._calculate_data_quality_score(df)
        n_samples = len(df)
        n_features = df.shape[1] - 1  # excluding target
        
        recommendations = []
        
        if task_type == "regression":
            model_candidates = [
                ("linear_regression", "Simple & interpretable", 50),
                ("elastic_net", "Handles multicollinearity well", 60),
                ("random_forest", "Robust to outliers & nonlinear relationships", 80),
                ("decision_tree", "Interpretable & handles mixed types", 40),
                ("knn", "Good for small datasets", 30),
                ("svm", "Powerful with proper scaling", 70),
            ]
            if HAS_XGBOOST:
                model_candidates.append(("xgboost", "Powerful & flexible", 90))
        else:  # classification
            model_candidates = [
                ("logistic_regression", "Simple & interpretable", 60),
                ("random_forest", "Robust & handles mixed features", 85),
                ("decision_tree", "Fast & interpretable", 50),
                ("knn", "Effective for non-linear patterns", 40),
                ("svm", "Strong for high-dimensional data", 75),
            ]
            if HAS_XGBOOST:
                model_candidates.append(("xgboost", "State-of-the-art", 95))
        
        # Adjust scores based on data characteristics
        for model_name, description, base_score in model_candidates:
            score = base_score
            reasons = [description]
            
            # Adjust for data quality
            if quality["null_rate"] > 10:
                if model_name in ["random_forest", "xgboost", "decision_tree"]:
                    score += 10
                    reasons.append("Handles missing values well")
            
            if quality["outlier_rate"] > 5:
                if model_name in ["random_forest", "xgboost", "decision_tree", "knn"]:
                    score += 10
                    reasons.append("Robust to outliers")
                else:
                    score -= 5
                    reasons.append("May be affected by outliers")
            
            # Adjust for dataset size
            if n_samples < 100:
                if model_name in ["linear_regression", "logistic_regression", "decision_tree", "knn"]:
                    score += 5
                    reasons.append("Good for small datasets")
                else:
                    score -= 5
            
            # Adjust for number of features
            if n_features > 50:
                if model_name in ["linear_regression", "logistic_regression", "svm"]:
                    score += 10
                    reasons.append("Handles high-dimensional data")
            
            recommendations.append({
                "model": model_name,
                "score": max(10, min(100, score)),
                "reasons": reasons,
            })
        
        # Sort by score
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        return recommendations

    def analyze(self, df: pd.DataFrame, target_col: str) -> Dict[str, Any]:
        """
        Analyze dataset and recommend models.
        
        Args:
            df: Input DataFrame
            target_col: Name of target column
            
        Returns:
            Dictionary with analysis results and model recommendations
        """
        if target_col not in df.columns:
            raise ValueError(f"Target column '{target_col}' not found in DataFrame")
        
        # Check for missing values in target
        target_nulls = df[target_col].isna().sum()
        if target_nulls > 0:
            raise ValueError(f"Target column '{target_col}' has {target_nulls} missing values. Please handle these first.")
        
        task_type = self._infer_task_type(df, target_col)
        quality = self._calculate_data_quality_score(df)
        recommendations = self._recommend_models(df, target_col, task_type)
        
        # Get model list based on task type
        available_models = self.REGRESSION_MODELS if task_type == "regression" else self.CLASSIFICATION_MODELS
        
        return {
            "task_type": task_type,
            "target_column": target_col,
            "data_quality": quality,
            "available_models": list(available_models.keys()),
            "recommended_models": recommendations[:5],  # Top 5
            "dataset_shape": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
        }

    def _prepare_data(self, df: pd.DataFrame, target_col: str, task_type: str) -> Tuple[pd.DataFrame, pd.Series]:
        """Prepare data for model training (encode categoricals, handle missing values)."""
        df_copy = df.copy()
        
        # Drop rows with missing target values (already checked in analyze)
        df_copy = df_copy.dropna(subset=[target_col])
        
        # Separate target
        y = df_copy[target_col]
        X = df_copy.drop(columns=[target_col])
        
        # Handle categorical features
        categorical_cols = X.select_dtypes(include=["object", "category"]).columns.tolist()
        if categorical_cols:
            X = pd.get_dummies(X, columns=categorical_cols, drop_first=True)
        
        # Fill remaining nulls with mean for numeric, mode for categorical
        for col in X.columns:
            if X[col].isna().any():
                if X[col].dtype in ["object", "category"]:
                    X[col].fillna(X[col].mode()[0] if len(X[col].mode()) > 0 else "unknown", inplace=True)
                else:
                    X[col].fillna(X[col].mean(), inplace=True)
        
        # Encode target if classification
        if task_type == "classification" and y.dtype in ["object", "category", "bool"]:
            le = LabelEncoder()
            y = pd.Series(le.fit_transform(y), index=y.index)
        
        return X, y

    def train(
        self,
        df: pd.DataFrame,
        target_col: str,
        model_name: str,
        task_type: str,
        test_size: float = 0.2,
        random_state: int = 42,
    ) -> Dict[str, Any]:
        """
        Train a model on the dataset.
        
        Args:
            df: Input DataFrame
            target_col: Name of target column
            model_name: Name of model to train
            task_type: 'regression' or 'classification'
            test_size: Proportion of data to use for testing
            random_state: Random seed for reproducibility
            
        Returns:
            Dictionary with trained model, metrics, and metadata
        """
        if target_col not in df.columns:
            raise ValueError(f"Target column '{target_col}' not found in DataFrame")
        
        # Get model class
        if task_type == "regression":
            if model_name not in self.REGRESSION_MODELS:
                raise ValueError(f"Unknown regression model: {model_name}")
            model_class = self.REGRESSION_MODELS[model_name]
        else:
            if model_name not in self.CLASSIFICATION_MODELS:
                raise ValueError(f"Unknown classification model: {model_name}")
            model_class = self.CLASSIFICATION_MODELS[model_name]
        
        # Prepare data
        X, y = self._prepare_data(df, target_col, task_type)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y if task_type == "classification" and len(y.unique()) > 1 else None
        )
        
        # Scale features for models that benefit from it
        if model_name in ["linear_regression", "elastic_net", "svm", "knn", "logistic_regression"]:
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
        else:
            X_train_scaled = X_train
            X_test_scaled = X_test
        
        # Train model with appropriate hyperparameters
        try:
            if model_name == "random_forest":
                model = model_class(n_estimators=100, random_state=random_state, n_jobs=-1)
            elif model_name == "xgboost":
                model = model_class(n_estimators=100, random_state=random_state, verbosity=0)
            elif model_name == "svm":
                model = model_class(kernel="rbf")
            elif model_name == "knn":
                model = model_class(n_neighbors=5)
            elif model_name == "elastic_net":
                model = model_class(random_state=random_state)
            elif model_name == "decision_tree":
                model = model_class(random_state=random_state)
            else:
                model = model_class()
            
            # Train model
            model.fit(X_train_scaled, y_train)
            
            # Make predictions
            y_pred_train = model.predict(X_train_scaled)
            y_pred_test = model.predict(X_test_scaled)
            
            # Calculate metrics
            if task_type == "regression":
                train_r2 = r2_score(y_train, y_pred_train)
                test_r2 = r2_score(y_test, y_pred_test)
                train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
                test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
                train_mae = mean_absolute_error(y_train, y_pred_train)
                test_mae = mean_absolute_error(y_test, y_pred_test)
                
                metrics = {
                    "train_r2": round(float(train_r2), 4),
                    "test_r2": round(float(test_r2), 4),
                    "train_rmse": round(float(train_rmse), 4),
                    "test_rmse": round(float(test_rmse), 4),
                    "train_mae": round(float(train_mae), 4),
                    "test_mae": round(float(test_mae), 4),
                }
            else:  # classification
                train_acc = accuracy_score(y_train, y_pred_train)
                test_acc = accuracy_score(y_test, y_pred_test)
                train_precision = precision_score(y_train, y_pred_train, average="weighted", zero_division=0)
                test_precision = precision_score(y_test, y_pred_test, average="weighted", zero_division=0)
                train_recall = recall_score(y_train, y_pred_train, average="weighted", zero_division=0)
                test_recall = recall_score(y_test, y_pred_test, average="weighted", zero_division=0)
                train_f1 = f1_score(y_train, y_pred_train, average="weighted", zero_division=0)
                test_f1 = f1_score(y_test, y_pred_test, average="weighted", zero_division=0)
                
                metrics = {
                    "train_accuracy": round(float(train_acc), 4),
                    "test_accuracy": round(float(test_acc), 4),
                    "train_precision": round(float(train_precision), 4),
                    "test_precision": round(float(test_precision), 4),
                    "train_recall": round(float(train_recall), 4),
                    "test_recall": round(float(test_recall), 4),
                    "train_f1": round(float(train_f1), 4),
                    "test_f1": round(float(test_f1), 4),
                }
            
            # Serialize model to bytes
            model_bytes = io.BytesIO()
            pickle.dump(model, model_bytes)
            model_bytes.seek(0)
            
            return {
                "model_name": model_name,
                "task_type": task_type,
                "target_column": target_col,
                "metrics": metrics,
                "data_split": {
                    "train_size": int(len(X_train)),
                    "test_size": int(len(X_test)),
                    "total_size": int(len(X)),
                },
                "trained_model": model,  # Return the actual model for storage
                "model_bytes": model_bytes.getvalue(),
                "feature_count": int(X.shape[1]),
                "status": "success",
            }
        except Exception as e:
            raise ValueError(f"Failed to train {model_name}: {str(e)}")
