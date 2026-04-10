import json
from web3 import Web3
from solcx import compile_standard, install_solc

# 1. Setup
ganache_url = "http://127.0.0.1:7545" # Ensure Ganache is running here
w3 = Web3(Web3.HTTPProvider(ganache_url))
install_solc('0.8.0')

# 2. Compile
with open("TransactionLedger.sol", "r") as file:
    contract_source = file.read()

compiled_sol = compile_standard({
    "language": "Solidity",
    "sources": {"TransactionLedger.sol": {"content": contract_source}},
    "settings": {"outputSelection": {"*": {"*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]}}}
}, solc_version="0.8.0")

abi = compiled_sol['contracts']['TransactionLedger.sol']['TransactionLedger']['abi']
bytecode = compiled_sol['contracts']['TransactionLedger.sol']['TransactionLedger']['evm']['bytecode']['object']

# 3. Deploy
account = w3.eth.accounts[0]
TransactionLedger = w3.eth.contract(abi=abi, bytecode=bytecode)
tx_hash = TransactionLedger.constructor().transact({'from': account})
tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

# 4. Save Configuration
config = {
    "address": tx_receipt.contractAddress,
    "abi": abi
}

with open("contract_config.json", "w") as f:
    json.dump(config, f)

print(f"Deployment Complete! Contract Address: {tx_receipt.contractAddress}")