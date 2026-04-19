#!/bin/bash
cd /app/backend
npx nest build && node dist/main.js
