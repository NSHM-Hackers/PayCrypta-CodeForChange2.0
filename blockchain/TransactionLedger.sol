// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TransactionLedger {
    struct Record {
        string dataHash;
        string localTxId;
        uint256 timestamp;
    }

    // A list to store all verified hashes
    Record[] public ledger;

    event HashRecorded(string dataHash, string localTxId);

    function recordHash(string memory _hash, string memory _localTxId) public {
        ledger.push(Record(_hash, _localTxId, block.timestamp));
        emit HashRecorded(_hash, _localTxId);
    }

    function getLedgerCount() public view returns (uint256) {
        return ledger.length;
    }
}
