# DataMind

## Features
- **Insight Agent**: Analyzes datasets and provides insights using Gemini 2.5 Flash.
- **Data Visualization**: Generates visualizations based on insights.
- **Live Dataset View**: View the current in-session dataset live after agent changes.
- **CSV Export**: Download the latest transformed dataset directly from the app.
- **Feature Engineering Agent**: Encodes categorical or selected columns with AI-guided strategy recommendations.
- **Interactive Dashboard**: A user-friendly interface to explore insights and visualizations.

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/NinadGawali/DataMind.git
2. Navigate to the project directory:
   ```bash
   cd DataMind
3. Create a virtual environment:
   ```bash
   python -m venv venv

4. Install dependencies:
   ```bash
    pip install -r requirements.txt

5. Set up environment variables:
   - Create a `.env` file in the root directory and add your Gemini API key:
     ```
     gemini_api_key=YOUR_GEMINI
        ```
6. Run the application backend:
    ```bash
    uvicorn main:app --reload
7. Navigate to the frontend directory and start the React app:
    ```bash
    cd frontend
    npm install
    npm run dev

