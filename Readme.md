# OC 2.0 Dashboard

[![Docker Build](https://img.shields.io/github/actions/workflow/status/blacksmithop/TOA/docker-image.yml?branch=main&style=for-the-badge&logo=docker&label=Docker%20Image&color=%23007BFF)](https://github.com/blacksmithop/TOA/actions/workflows/docker-image.yml) [![Github Pages](https://img.shields.io/github/actions/workflow/status/blacksmithop/TOA/gh-pages.yml?branch=main&style=for-the-badge&logo=nextdotjs&label=Website)](https://github.com/blacksmithop/TOA/actions/workflows/gh-pages.yml) 

## Usage

> [!IMPORTANT]
> You need to have Faction API access to use the core-features

Head over to [oc.tornrevive.page](https://oc.tornrevive.page/) and create your Custom API Key. 

<img width="25%" height="25%" alt="image" src="https://github.com/user-attachments/assets/c6e12afc-813f-42ef-a44d-08c32bebaafe" /> 
<img width="25%" height="25%" alt="image" src="https://github.com/user-attachments/assets/690ecbd6-e439-49f9-9683-90efdd3ad4bc" />


## Screenshots

#### Dashboard

<img width="50%" height="50%" alt="image" src="https://github.com/user-attachments/assets/1c00ba48-7683-4f5a-ac51-a00f394b4cbd" />

> [!NOTE]
> You will only be able to access features that you checked while creating the API Key. Following features are enabled by default

<img width="50%" height="50%" alt="image" src="https://github.com/user-attachments/assets/8fddc194-5f70-4d81-a61a-f212e1cea903" />

### Organized Crimes

<img width="50%" height="50%" alt="image" src="https://github.com/user-attachments/assets/dc2df516-9e35-4e3f-9f6f-8d7f30006b1a" />

#### Enhanced crime information

<img width="50%" height="50%" alt="image" src="https://github.com/user-attachments/assets/16bb1feb-8418-4eaa-8efe-9fcd290860c7" />

<img width="50%" height="50%" alt="image" src="https://github.com/user-attachments/assets/8e61562a-c713-4925-8fc2-8880050c60cf" />

#### Participant live status

<img width="25%" height="25%" alt="image" src="https://github.com/user-attachments/assets/5109492d-3be3-4e5d-b562-48aba2a824fd" />

<img width="25%" height="25%" alt="image" src="https://github.com/user-attachments/assets/b47cb4aa-966a-4707-bda7-6af474abc27f" />

<img width="25%" height="25%" alt="image" src="https://github.com/user-attachments/assets/93fc6aab-183f-477e-9c83-9f458692252b" />

<img width="25%" height="25%" alt="image" src="https://github.com/user-attachments/assets/83d2e406-7dc9-4c87-acc0-62d1df530893" />

<img width="25%" height="25%" alt="image" src="https://github.com/user-attachments/assets/3c80161e-1747-4d28-8dbe-89672bde1b33" />

<img width="25%" height="25%" alt="image" src="https://github.com/user-attachments/assets/5b97f02e-1753-491e-b81e-4e663d20428f" />

### Crime Reports

<img width="50%" height="50%" alt="image" src="https://github.com/user-attachments/assets/7ad3a657-e3b9-4286-a968-bd35c49cf012" />

<img width="30%" height="30%" alt="image" src="https://github.com/user-attachments/assets/f4240511-f6ee-4dd2-b012-9afa265e2230" />

#### Crime Scope Usage

<img width="50%" height="50%" alt="image" src="https://github.com/user-attachments/assets/e9a371fc-eadb-4894-a2ba-3ab86a6627ca" />




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
