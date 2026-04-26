@echo off
echo NeuroSync - Installing dependencies...
npm install
if %errorlevel% neq 0 (
  echo ERROR: npm install failed with error code %errorlevel%
  exit /b %errorlevel%
)

echo Installing backend dependencies...
pushd server
npm install
if %errorlevel% neq 0 (
  echo ERROR: backend npm install failed with error code %errorlevel%
  popd
  exit /b %errorlevel%
)
popd

echo Starting backend server in a new window...
start "NeuroSync Backend" cmd /k "cd /d %cd%\server && npm run dev"

echo Starting frontend development server...
npm run dev
