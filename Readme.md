# OC 2.0 Dashboard

[![Docker Build](https://img.shields.io/github/actions/workflow/status/blacksmithop/TOA/docker-image.yml?branch=main&style=for-the-badge&logo=docker&label=Docker%20Image&color=%23007BFF)](https://github.com/blacksmithop/TOA/actions/workflows/docker-image.yml) [![Github Pages](https://img.shields.io/github/actions/workflow/status/blacksmithop/TOA/gh-pages.yml?branch=main&style=for-the-badge&logo=nextdotjs&label=Website)](https://github.com/blacksmithop/TOA/actions/workflows/gh-pages.yml) 

## Usage

Visit the [dashboard](https://oc.tornrevive.page/)

### Create your Custom API Key

<img src="./docs//images/custom_api_key.png" width="25%" alt="Custom API Key">

Explore the dashboard

<img src="./docs//images/dashboard.png" width="75%" alt="Dashboard">


## Installation

```bash
npm i
```

Run the server

```bash
npm run dev
```

## Proxy

In order to bypass CORS for [Torn Probability API](https://tornprobability.com:3000/api-docs/#/) I am running my own proxy backend.
The source code can be found [here](./proxy/)

```bash
cd proxy
```

```bash
pip install -r requirements.txt
```

Run the FastAPI server and change the URL used in [success-prediction](./lib/success-prediction.ts) and [role-weights](.lib/role-weights.ts)

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```