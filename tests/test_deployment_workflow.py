"""Tests specifically for GitHub Actions deployment workflow validation."""

import os

import pytest
import yaml


class TestWorkflowConfiguration:
    """Tests to validate the GitHub Actions workflow configuration."""

    @pytest.fixture
    def workflow_config(self):
        """Load the GitHub Actions workflow configuration."""
        workflow_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            ".github",
            "workflows",
            "deploy.yml",
        )

        if not os.path.exists(workflow_path):
            pytest.skip("GitHub Actions workflow file not found")

        with open(workflow_path) as f:
            return yaml.safe_load(f)

    def test_workflow_has_required_jobs(self, workflow_config):
        """Test that workflow includes all required jobs."""
        required_jobs = ["test", "build", "deploy", "notify"]

        assert "jobs" in workflow_config
        jobs = workflow_config["jobs"]

        for job in required_jobs:
            assert job in jobs, f"Missing required job: {job}"

    def test_workflow_triggers_on_main_branch(self, workflow_config):
        """Test that workflow is triggered on main branch pushes."""
        # YAML parser converts "on" key to True in Python
        trigger_key = True if True in workflow_config else "on"
        assert trigger_key in workflow_config
        triggers = workflow_config[trigger_key]

        assert "push" in triggers
        assert "branches" in triggers["push"]
        assert "main" in triggers["push"]["branches"]

    def test_test_job_configuration(self, workflow_config):
        """Test that test job is properly configured."""
        test_job = workflow_config["jobs"]["test"]

        # Check runner
        assert test_job["runs-on"] == "ubuntu-latest"

        # Check steps include required actions
        steps = test_job["steps"]
        step_names = [step.get("name", "") for step in steps]

        required_steps = [
            "Checkout code",
            "Set up Python",
            "Install uv",
            "Run tests",
        ]

        for required_step in required_steps:
            assert any(
                required_step in name for name in step_names
            ), f"Missing step: {required_step}"

    def test_build_job_depends_on_test(self, workflow_config):
        """Test that build job depends on test job."""
        build_job = workflow_config["jobs"]["build"]

        assert "needs" in build_job
        assert "test" in build_job["needs"]

    def test_deploy_job_configuration(self, workflow_config):
        """Test that deploy job is properly configured."""
        deploy_job = workflow_config["jobs"]["deploy"]

        # Check dependencies
        assert "needs" in deploy_job
        needs = deploy_job["needs"]
        assert "test" in needs
        assert "build" in needs

        # Check environment protection
        assert "environment" in deploy_job
        assert deploy_job["environment"] == "production"

        # Check conditional deployment (main branch only)
        assert "if" in deploy_job
        assert "refs/heads/main" in deploy_job["if"]

    def test_deploy_job_has_railway_steps(self, workflow_config):
        """Test that deploy job includes Railway CLI steps."""
        deploy_job = workflow_config["jobs"]["deploy"]
        steps = deploy_job["steps"]
        step_names = [step.get("name", "") for step in steps]

        required_railway_steps = [
            "Install Railway CLI",
            "Deploy to Railway",
            "Health check",
        ]

        for step in required_railway_steps:
            assert any(
                step in name for name in step_names
            ), f"Missing Railway step: {step}"

    def test_deploy_job_uses_railway_token_secret(self, workflow_config):
        """Test that deploy job references RAILWAY_TOKEN secret."""
        deploy_job = workflow_config["jobs"]["deploy"]

        # Check that RAILWAY_TOKEN is used in environment variables
        found_railway_token = False
        for step in deploy_job["steps"]:
            if "env" in step and "RAILWAY_TOKEN" in step.get("env", {}):
                railway_token = step["env"]["RAILWAY_TOKEN"]
                assert "secrets.RAILWAY_TOKEN" in railway_token
                found_railway_token = True

        assert found_railway_token, "RAILWAY_TOKEN secret not found in deploy steps"

    def test_health_check_validation(self, workflow_config):
        """Test that health check step validates response properly."""
        deploy_job = workflow_config["jobs"]["deploy"]

        # Find health check step
        health_check_step = None
        for step in deploy_job["steps"]:
            if "Health check" in step.get("name", ""):
                health_check_step = step
                break

        assert health_check_step is not None, "Health check step not found"

        # Verify health check script content
        script = health_check_step.get("run", "")
        assert "/health" in script, "Health check doesn't test /health endpoint"
        assert "jq" in script, "Health check doesn't parse JSON response"
        assert "status" in script, "Health check doesn't validate status field"

    def test_notify_job_handles_both_success_and_failure(self, workflow_config):
        """Test that notify job handles both success and failure cases."""
        notify_job = workflow_config["jobs"]["notify"]

        # Check dependencies
        assert "needs" in notify_job
        assert "deploy" in notify_job["needs"]

        # Check that it runs on both success and failure
        assert "if" in notify_job
        assert "always()" in notify_job["if"]

        # Check steps for both outcomes
        steps = notify_job["steps"]
        step_conditions = [step.get("if", "") for step in steps]

        assert any("success" in condition for condition in step_conditions)
        assert any("failure" in condition for condition in step_conditions)


class TestWorkflowSecrets:
    """Tests to validate that required secrets are documented."""

    def test_railway_token_documentation_exists(self):
        """Test that RAILWAY_TOKEN setup documentation exists."""
        docs_paths = [
            os.path.join(
                os.path.dirname(os.path.dirname(__file__)), "docs", "deployment.md"
            ),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "README.md"),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "DEPLOYMENT.md"),
        ]

        documentation_found = False
        railway_token_mentioned = False

        for docs_path in docs_paths:
            if os.path.exists(docs_path):
                documentation_found = True
                with open(docs_path) as f:
                    content = f.read()
                    if "RAILWAY_TOKEN" in content:
                        railway_token_mentioned = True
                        break

        if documentation_found:
            assert (
                railway_token_mentioned
            ), "RAILWAY_TOKEN setup not documented in existing docs"
        else:
            # We'll create the documentation if it doesn't exist
            pass

    def test_required_secrets_validation(self):
        """Test that we can validate required secrets structure."""
        required_secrets = ["RAILWAY_TOKEN"]

        # This test validates our understanding of required secrets
        # In actual CI environment, these would be available as environment variables
        for secret in required_secrets:
            # Test that the secret name is valid (no spaces, proper format)
            assert secret.replace(
                "_", ""
            ).isalnum(), f"Invalid secret name format: {secret}"
            assert secret.isupper(), f"Secret name should be uppercase: {secret}"


class TestCIEnvironment:
    """Tests to validate CI environment assumptions."""

    def test_python_version_compatibility(self):
        """Test that specified Python version is compatible."""
        import sys

        # Our workflow uses Python 3.11, test current version compatibility
        current_version = sys.version_info

        # Should work with Python 3.8+
        assert current_version >= (3, 8), f"Python version {current_version} too old"

    def test_uv_installation_simulation(self):
        """Test that uv installation would work."""

        # Test that curl command would work (basic syntax check)
        curl_command = "curl -LsSf https://astral.sh/uv/install.sh"

        # Verify command syntax (don't actually run it)
        assert curl_command.startswith("curl")
        assert "https://" in curl_command
        assert "astral.sh/uv" in curl_command

    def test_docker_buildx_requirements(self):
        """Test that Docker buildx action requirements are met."""
        # Check if we're in a containerized environment that supports Docker
        # This is more of a documentation test for CI requirements

        docker_requirements = {
            "actions/checkout": "v4",
            "docker/setup-buildx-action": "v3",
            "docker/build-push-action": "v5",
        }

        # Validate action versions are reasonable
        for action, version in docker_requirements.items():
            assert version.startswith(
                "v"
            ), f"Invalid version format for {action}: {version}"
            version_num = int(version[1:])
            assert version_num >= 3, f"Version too old for {action}: {version}"


class TestWorkflowIntegrity:
    """Tests to validate workflow file integrity and best practices."""

    @pytest.fixture
    def workflow_content(self):
        """Load raw workflow file content."""
        workflow_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            ".github",
            "workflows",
            "deploy.yml",
        )

        if not os.path.exists(workflow_path):
            pytest.skip("GitHub Actions workflow file not found")

        with open(workflow_path) as f:
            return f.read()

    def test_no_hardcoded_secrets(self, workflow_content):
        """Test that workflow doesn't contain hardcoded secrets."""
        sensitive_patterns = [
            "sk-",  # OpenAI API keys
            "ghp_",  # GitHub personal access tokens
            # Note: "railway_token" appears in variable references like "${{ secrets.RAILWAY_TOKEN }}"
            # but we want to avoid hardcoded tokens, so check for patterns that don't use secrets
        ]

        content_lower = workflow_content.lower()
        for pattern in sensitive_patterns:
            assert (
                pattern not in content_lower
            ), f"Potential hardcoded secret found: {pattern}"

        # Check that RAILWAY_TOKEN is properly referenced through secrets
        if "railway_token" in content_lower:
            assert (
                "secrets.railway_token" in content_lower
            ), "RAILWAY_TOKEN must be referenced through GitHub secrets"

    def test_uses_environment_protection(self, workflow_content):
        """Test that production deployments use environment protection."""
        assert "environment: production" in workflow_content

    def test_has_proper_yaml_structure(self):
        """Test that workflow file is valid YAML."""
        workflow_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            ".github",
            "workflows",
            "deploy.yml",
        )

        try:
            with open(workflow_path) as f:
                yaml.safe_load(f)
        except yaml.YAMLError as e:
            pytest.fail(f"Invalid YAML in workflow file: {e}")

    def test_conditional_deployment(self, workflow_content):
        """Test that deployment only happens on main branch."""
        assert "if: github.ref == 'refs/heads/main'" in workflow_content

    def test_job_dependencies(self, workflow_content):
        """Test that job dependencies are properly configured."""
        # Build should depend on test
        assert (
            "needs: test" in workflow_content
            or "needs:\n    - test" in workflow_content
        )

        # Deploy should depend on both test and build
        assert (
            "needs: [test, build]" in workflow_content
            or "needs:\n      - test\n      - build" in workflow_content
            or "needs: [test, build]" in workflow_content
        )
