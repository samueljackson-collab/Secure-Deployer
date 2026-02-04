"""Package setup for the automation toolkit."""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [
        line.strip()
        for line in fh
        if line.strip() and not line.startswith("#")
    ]

setup(
    name="automation-toolkit",
    version="0.1.0",
    author="Infrastructure Team",
    author_email="infra-team@example.com",
    description="Modular Python toolkit for cloud operations automation",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/example-org/p20-python-tooling-automation",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    python_requires=">=3.10",
    install_requires=[
        "boto3>=1.34.0,<2.0.0",
        "click>=8.1.0,<9.0.0",
        "pyyaml>=6.0.0,<7.0.0",
        "rich>=13.7.0,<14.0.0",
        "requests>=2.31.0,<3.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=8.0.0,<9.0.0",
            "moto[ec2]>=5.0.0,<6.0.0",
            "mypy>=1.8.0",
            "ruff>=0.3.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "automation-toolkit=automation_toolkit.cli:main",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: System Administrators",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: System :: Systems Administration",
        "Typing :: Typed",
    ],
)
