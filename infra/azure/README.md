# Azure Qatar — CLI bootstrap

Target architecture: [docs/AZURE_QATAR_INFRASTRUCTURE.md](../../docs/AZURE_QATAR_INFRASTRUCTURE.md)  
Implementation plan: [docs/AZURE_QATAR_HOSTING.md](../../docs/AZURE_QATAR_HOSTING.md)

## Prerequisites

1. [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli): `az --version`
2. Login: `az login`
3. Set subscription: `az account set --subscription "<subscription-id>"`
4. Confirm Qatar access: `az account list-locations --query "[?name=='qatarcentral']"`

## Region (required)

All production resources:

```text
--location qatarcentral
```

## Suggested order

1. Resource group + VNet + Key Vault + Log Analytics  
2. PostgreSQL Flexible Server (HA) + Redis + Blob  
3. Azure Container Registry → build/push `packages/api/Dockerfile`  
4. Container Apps (API, min 2 replicas)  
5. Static Web Apps (six portals)  
6. Front Door / WAF + custom domains  
7. `prisma migrate deploy` against Azure Postgres  
8. DNS cutover from Vercel/Railway  

Full command examples and sizing for ~10k apps / 500M QAR/year: **Appendix A & B** in [AZURE_QATAR_INFRASTRUCTURE.md](../../docs/AZURE_QATAR_INFRASTRUCTURE.md).

## Bicep (recommended for prod)

Add templates here when ready:

```bash
az deployment group create \
  --resource-group blox-market-qa-staging \
  --template-file main.bicep \
  --parameters @parameters.staging.json
```

Do **not** commit secrets. Use Key Vault references in parameters files.

## Deploy API image (after ACR exists)

From repository root:

```bash
az acr login --name <acr-name>
docker build -f packages/api/Dockerfile -t <acr-name>.azurecr.io/blox-api:latest .
docker push <acr-name>.azurecr.io/blox-api:latest
az containerapp update --name blox-api --resource-group <rg> \
  --image <acr-name>.azurecr.io/blox-api:latest
```

## Deploy a portal

```bash
npm run build -w @drivemarket/marketplace
# Azure Static Web Apps CLI or az staticwebapp linked to GitHub Actions
```

## From Cursor

Open the integrated terminal in this repo and run the same `az` commands. The Cursor agent can draft Bicep and shell scripts; you approve `az login` and production applies.
