#!/bin/bash

# Iniciar o backend
if [ -d "backend" ]; then
  echo "Iniciando o backend..."
  cd backend
  node server.js &
  cd ..
else
  echo "Pasta backend não encontrada!"
fi

# Iniciar o frontend
if [ -d "frontend" ]; then
  echo "Iniciando o frontend..."
  cd frontend
  serve -s build &
  cd ..
else
  echo "Pasta frontend não encontrada!"
fi

# Aguarda os processos em segundo plano
wait
