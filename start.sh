#!/bin/sh
node /app/dist/index.js &
exec nginx -g "daemon off;"
