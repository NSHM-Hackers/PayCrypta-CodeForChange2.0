# PayCrypta-CodeForChange2.0

Our team PayCrypta's project for NSHM CodeForChange2.0

## Disclaimer

**GitHub Copilot** extension for **VS Code** has been used to help and accelerate the development of the prpoject.

## Goal

Our goal with this project is to create a Payment App + Gateway that will be completely transparent about the exchange and the charges the user has to pay.

## Tech Stack

Backend: ExpressJs app served by NodeJs, Python flask app for adding transaction to blockchain

Fronted: Vite+ReactJs SPA built and served as static content by the ExpressJs app

Database: Mongodb cluster

Nginx: Acting as a reverse proxy for the ExpressJs app and handles SSL

Deployed at: [Digital Ocean Droplet](https://paycrypta.rahulraman.in ) (for the duration of hackathon)

## External Library & APIs

Ganache: Simulating Ethereum blockchain network

Python requirements: web3, py-solc-x, flask

backend npm libraries: axios, bcryptjs, cors, dotenv, express, jsonwebtoken, mongoose, ws

frontend npm libraries: antd, axios, chart.js, event-source-polyfill, react, react-chartjs-2, react-dom, react-router-dom

API from <https://www.exchangerate-api.com/>

## Setup to run locally

_Assuming you have access to a linux machine or wsl in windows._

1. clone the repository `git clone https://github.com/NSHM-Hackers/PayCrypta-CodeForChange2.0.git`
2. setup python dependencies: `cd blockchain && chmod +x ./*.sh  && ./setup.sh`
3. start the ganache app and python app (while still in blockchain folder): `tmux new-session -d -s python_ganache './start.sh'`
4. install frontend dependencies: `cd ../frontend && npm i`
5. install backend dependencies: `cd ../backend && npm i`
6. run the express app (while still in backend folder): `tmux new-session -d -s nodejs_express 'npm run start'`
