from flask import Flask, jsonify, request
from web3 import Web3
import json

app = Flask(__name__)

w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:7545"))

with open("contract_config.json", "r") as f:
    config = json.load(f)

# Connect to the existing contract on the blockchain
contract_instance = w3.eth.contract(address=config["address"], abi=config["abi"])
account = w3.eth.accounts[0]

@app.route('/record-transaction', methods=['POST'])
def record_transaction():
    data = request.json
    incoming_hash = data.get('hash')
    local_tx_id = data.get('localTxId')

    try:
        # Transact with the already-deployed instance
        print(f"[Blockchain] Recording transaction with hash: {incoming_hash} and localTxId: {local_tx_id}")
        tx_hash = contract_instance.functions.recordHash(
            incoming_hash, 
            local_tx_id
        ).transact({'from': account})

        print(f"[Blockchain] Transaction sent with hash: {tx_hash.hex()}. Waiting for confirmation...")
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        print(f"[Blockchain] Transaction confirmed in block {receipt.blockNumber} with hash: {receipt.transactionHash.hex()}")
        return jsonify({
            "status": "success",
            "blockchain_id": receipt.transactionHash.hex(),
            "block_number": receipt.blockNumber,
            "contract_address": config["address"]
        }), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5071)