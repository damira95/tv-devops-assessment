import { App, TerraformStack, TerraformOutput, Fn } from "cdktf";
import { Construct } from "constructs";

import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { DataAwsAvailabilityZones } from "@cdktf/provider-aws/lib/data-aws-availability-zones";

import { Vpc } from "@cdktf/provider-aws/lib/vpc";
import { Subnet } from "@cdktf/provider-aws/lib/subnet";
import { InternetGateway } from "@cdktf/provider-aws/lib/internet-gateway";
import { RouteTable } from "@cdktf/provider-aws/lib/route-table";
import { Route } from "@cdktf/provider-aws/lib/route";
import { RouteTableAssociation } from "@cdktf/provider-aws/lib/route-table-association";

import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";

import { EcrRepository } from "@cdktf/provider-aws/lib/ecr-repository";

import { Lb } from "@cdktf/provider-aws/lib/lb";
import { LbTargetGroup } from "@cdktf/provider-aws/lib/lb-target-group";
import { LbListener } from "@cdktf/provider-aws/lib/lb-listener";

import { EcsCluster } from "@cdktf/provider-aws/lib/ecs-cluster";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service";

import { CloudwatchLogGroup } from "@cdktf/provider-aws/lib/cloudwatch-log-group";

import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";

class TvAssessmentStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const region = process.env.AWS_REGION || "us-east-1";
    const appName = process.env.APP_NAME || "tv-assessment-app";
    const containerPort = Number(process.env.CONTAINER_PORT || "3000");
    const imageTag = process.env.IMAGE_TAG || "latest";

    new AwsProvider(this, "aws", {
      region,
    });

    const azs = new DataAwsAvailabilityZones(this, "azs", {
      state: "available",
    });

    // VPC
    const vpc = new Vpc(this, "vpc", {
      cidrBlock: "10.0.0.0/16",
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: {
        Name: `${appName}-vpc`,
      },
    });

    const publicSubnet1 = new Subnet(this, "publicSubnet1", {
      vpcId: vpc.id,
      cidrBlock: "10.0.1.0/24",
      availabilityZone: Fn.element(azs.names, 0),
      mapPublicIpOnLaunch: true,
      tags: {
        Name: `${appName}-public-subnet-1`,
      },
    });

    const publicSubnet2 = new Subnet(this, "publicSubnet2", {
      vpcId: vpc.id,
      cidrBlock: "10.0.2.0/24",
      availabilityZone: Fn.element(azs.names, 1),
      mapPublicIpOnLaunch: true,
      tags: {
        Name: `${appName}-public-subnet-2`,
      },
    });

    const internetGateway = new InternetGateway(this, "internetGateway", {
      vpcId: vpc.id,
      tags: {
        Name: `${appName}-igw`,
      },
    });

    const publicRouteTable = new RouteTable(this, "publicRouteTable", {
      vpcId: vpc.id,
      tags: {
        Name: `${appName}-public-rt`,
      },
    });

    new Route(this, "defaultInternetRoute", {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.id,
    });

    new RouteTableAssociation(this, "publicSubnetAssoc1", {
      subnetId: publicSubnet1.id,
      routeTableId: publicRouteTable.id,
    });

    new RouteTableAssociation(this, "publicSubnetAssoc2", {
      subnetId: publicSubnet2.id,
      routeTableId: publicRouteTable.id,
    });

    // Security Groups
    const albSecurityGroup = new SecurityGroup(this, "albSecurityGroup", {
      name: `${appName}-alb-sg`,
      vpcId: vpc.id,
      ingress: [
        {
          description: "Allow HTTP from internet",
          protocol: "tcp",
          fromPort: 80,
          toPort: 80,
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      egress: [
        {
          description: "Allow all outbound",
          protocol: "-1",
          fromPort: 0,
          toPort: 0,
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      tags: {
        Name: `${appName}-alb-sg`,
      },
    });

    const ecsSecurityGroup = new SecurityGroup(this, "ecsSecurityGroup", {
      name: `${appName}-ecs-sg`,
      vpcId: vpc.id,
      ingress: [
        {
          description: "Allow app traffic only from ALB",
          protocol: "tcp",
          fromPort: containerPort,
          toPort: containerPort,
          securityGroups: [albSecurityGroup.id],
        },
      ],
      egress: [
        {
          description: "Allow all outbound",
          protocol: "-1",
          fromPort: 0,
          toPort: 0,
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      tags: {
        Name: `${appName}-ecs-sg`,
      },
    });

    // ECR
    const ecrRepository = new EcrRepository(this, "ecrRepository", {
      name: appName,
      imageTagMutability: "MUTABLE",
      forceDelete: true,
      tags: {
        Name: `${appName}-ecr`,
      },
    });

    // ALB
    const alb = new Lb(this, "alb", {
      name: `${appName}-alb`,
      internal: false,
      loadBalancerType: "application",
      securityGroups: [albSecurityGroup.id],
      subnets: [publicSubnet1.id, publicSubnet2.id],
      tags: {
        Name: `${appName}-alb`,
      },
    });

    const targetGroup = new LbTargetGroup(this, "targetGroup", {
      name: `${appName}-tg`,
      port: containerPort,
      protocol: "HTTP",
      targetType: "ip",
      vpcId: vpc.id,
      healthCheck: {
        enabled: true,
        path: "/health",
        protocol: "HTTP",
        matcher: "200",
        interval: 30,
        timeout: 5,
        healthyThreshold: 2,
        unhealthyThreshold: 2,
      },
      tags: {
        Name: `${appName}-tg`,
      },
    });

    const listener = new LbListener(this, "listener", {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: "HTTP",
      defaultAction: [
        {
          type: "forward",
          targetGroupArn: targetGroup.arn,
        },
      ],
    });

    // ECS
    const cluster = new EcsCluster(this, "cluster", {
      name: `${appName}-cluster`,
      tags: {
        Name: `${appName}-cluster`,
      },
    });

    const logGroup = new CloudwatchLogGroup(this, "logGroup", {
      name: `/ecs/${appName}`,
      retentionInDays: 7,
      tags: {
        Name: `${appName}-logs`,
      },
    });

    const executionRole = new IamRole(this, "executionRole", {
      name: `${appName}-execution-role`,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "ecs-tasks.amazonaws.com",
            },
            Action: "sts:AssumeRole",
          },
        ],
      }),
      tags: {
        Name: `${appName}-execution-role`,
      },
    });

    new IamRolePolicyAttachment(this, "executionRolePolicyAttachment", {
      role: executionRole.name,
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    const taskDefinition = new EcsTaskDefinition(this, "taskDefinition", {
      family: `${appName}-task`,
      requiresCompatibilities: ["FARGATE"],
      networkMode: "awsvpc",
      cpu: "256",
      memory: "512",
      executionRoleArn: executionRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name: appName,
          image: `${ecrRepository.repositoryUrl}:${imageTag}`,
          essential: true,
          portMappings: [
            {
              containerPort: containerPort,
              hostPort: containerPort,
              protocol: "tcp",
            },
          ],
          environment: [
            {
              name: "PORT",
              value: String(containerPort),
            },
            {
              name: "NODE_ENV",
              value: "production",
            },
          ],
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": logGroup.name,
              "awslogs-region": region,
              "awslogs-stream-prefix": "ecs",
            },
          },
        },
      ]),
      tags: {
        Name: `${appName}-task-def`,
      },
    });

    const ecsService = new EcsService(this, "ecsService", {
      name: `${appName}-service`,
      cluster: cluster.id,
      taskDefinition: taskDefinition.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: [publicSubnet1.id, publicSubnet2.id],
        securityGroups: [ecsSecurityGroup.id],
        assignPublicIp: true,
      },
      loadBalancer: [
        {
          targetGroupArn: targetGroup.arn,
          containerName: appName,
          containerPort: containerPort,
        },
      ],
      dependsOn: [listener],
      tags: {
        Name: `${appName}-service`,
      },
    });

    // Outputs
    new TerraformOutput(this, "aws_region", {
      value: region,
    });

    new TerraformOutput(this, "ecr_repository_url", {
      value: ecrRepository.repositoryUrl,
    });

    new TerraformOutput(this, "ecs_cluster_name", {
      value: cluster.name,
    });

    new TerraformOutput(this, "ecs_service_name", {
      value: ecsService.name,
    });

    new TerraformOutput(this, "alb_dns_name", {
      value: alb.dnsName,
    });

    new TerraformOutput(this, "health_url", {
      value: `http://${alb.dnsName}/health`,
    });
  }
}

const app = new App();
new TvAssessmentStack(app, "tv-assessment-stack");
app.synth();
