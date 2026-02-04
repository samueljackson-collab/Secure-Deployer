###############################################################################
# P02 IAM Security Hardening -- Root Module
#
# Composes the iam-policy and iam-assumable-role sub-modules to provision a
# production-ready IAM configuration demonstrating least-privilege practices.
###############################################################################

terraform {
  required_version = ">= 1.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "p02-iam-security-hardening"
      ManagedBy = "terraform"
    }
  }
}

# ---------------------------------------------------------------------------
# IAM Policy: Application read-only access
# ---------------------------------------------------------------------------

module "app_read_policy" {
  source = "./modules/iam-policy"

  policy_name = "${var.project_prefix}-app-read-only"
  description = "Read-only access for the application workload."

  policy_statements = [
    {
      sid       = "AllowS3Read"
      effect    = "Allow"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = var.s3_bucket_arns
      conditions = [
        {
          test     = "StringEquals"
          variable = "aws:RequestedRegion"
          values   = [var.aws_region]
        }
      ]
    },
    {
      sid       = "AllowDynamoDBRead"
      effect    = "Allow"
      actions   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:Scan"]
      resources = var.dynamodb_table_arns
      conditions = []
    },
  ]

  tags = var.tags
}

# ---------------------------------------------------------------------------
# IAM Policy: CI/CD deployment permissions
# ---------------------------------------------------------------------------

module "deploy_policy" {
  source = "./modules/iam-policy"

  policy_name = "${var.project_prefix}-ci-deploy"
  description = "Deployment permissions for the CI/CD pipeline."

  policy_statements = [
    {
      sid    = "AllowECRPush"
      effect = "Allow"
      actions = [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
      ]
      resources = var.ecr_repository_arns
      conditions = []
    },
    {
      sid    = "AllowECSUpdateService"
      effect = "Allow"
      actions = [
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
      ]
      resources = var.ecs_service_arns
      conditions = []
    },
  ]

  tags = var.tags
}

# ---------------------------------------------------------------------------
# IAM Role: Application workload role
# ---------------------------------------------------------------------------

module "app_role" {
  source = "./modules/iam-assumable-role"

  role_name   = "${var.project_prefix}-app-workload"
  description = "Role assumed by the application ECS tasks."

  trusted_entities = [
    {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
      conditions  = []
    }
  ]

  policy_arns          = [module.app_read_policy.policy_arn]
  permissions_boundary = var.permissions_boundary_arn

  tags = var.tags
}

# ---------------------------------------------------------------------------
# IAM Role: CI/CD deployer role
# ---------------------------------------------------------------------------

module "deployer_role" {
  source = "./modules/iam-assumable-role"

  role_name            = "${var.project_prefix}-ci-deployer"
  description          = "Role assumed by the CI/CD pipeline for deployments."
  max_session_duration = var.ci_max_session_duration

  trusted_entities = var.ci_trusted_entities

  policy_arns          = [module.deploy_policy.policy_arn]
  permissions_boundary = var.permissions_boundary_arn

  tags = var.tags
}
