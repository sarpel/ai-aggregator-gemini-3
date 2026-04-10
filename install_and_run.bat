@echo off
echo NeuroSync - Installing dependencies...
npm install
if %errorlevel% neq 0 (
  echo ERROR: npm install failed with error code %errorlevel%
  exit /b %errorlevel%
)

echo Starting development server...
npm run dev
