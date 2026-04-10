#!/bin/bash
set -e

echo "NeuroSync - Installing dependencies..."
npm install

echo "Starting development server..."
npm run dev
