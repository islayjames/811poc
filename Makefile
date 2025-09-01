# Texas 811 POC Development Makefile

.PHONY: help install test lint format type-check run clean dev-setup

# Default target
help:
	@echo "Available targets:"
	@echo "  install     - Install project dependencies"
	@echo "  test        - Run all tests"
	@echo "  lint        - Run ruff linter"
	@echo "  format      - Format code with black and ruff"
	@echo "  type-check  - Run mypy type checking"
	@echo "  run         - Run FastAPI development server"
	@echo "  clean       - Remove build artifacts and caches"
	@echo "  dev-setup   - Complete development environment setup"

# Install dependencies
install:
	uv pip install -e .
	uv pip install -e ".[dev]"

# Run tests
test:
	.venv/bin/python -m pytest tests/ -v --cov=src/texas811_poc --cov-report=term-missing

# Lint with ruff
lint:
	.venv/bin/ruff check src/ tests/

# Format code
format:
	.venv/bin/black src/ tests/
	.venv/bin/ruff check --fix src/ tests/

# Type checking
type-check:
	.venv/bin/mypy src/texas811_poc/

# Run development server
run:
	.venv/bin/python -m src.texas811_poc.main

# Clean up
clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf build/ dist/ .coverage htmlcov/ .pytest_cache/ .mypy_cache/

# Complete dev setup
dev-setup: install
	.venv/bin/pre-commit install
	@echo "✓ Development environment ready!"
	@echo "  Run 'make test' to verify setup"
	@echo "  Run 'make run' to start development server"
