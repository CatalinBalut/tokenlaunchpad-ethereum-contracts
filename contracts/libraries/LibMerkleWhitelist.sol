// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.8.0;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";

library LibMerkleWhitelist {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.merklewhitelist.storage");

    struct WhitelistStorage {
        bytes32 merkleRoot;
    }

    function whitelistStorage() internal pure returns (WhitelistStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function setMerkleRoot(bytes32 coolOff) internal {
        LibMerkleWhitelist.WhitelistStorage storage ds = whitelistStorage();
        ds.merkleRoot = coolOff;
    }

    function getMerkleRoot() internal view returns (bytes32 merkleRoot_) {
        merkleRoot_ = whitelistStorage().merkleRoot;
    }

    function verifyUserWhitelist (bytes32[] calldata merkleProof) internal view {
        LibMerkleWhitelist.WhitelistStorage storage ds = whitelistStorage();
        require(MerkleProof.verify(merkleProof, ds.merkleRoot, keccak256(abi.encodePacked(msg.sender))), "Sale: invalid merkle proof");
    }
}
