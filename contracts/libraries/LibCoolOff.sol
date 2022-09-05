// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6 <0.8.0;

library LibCoolOffPeriod {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.cooloff.storage");

    struct CoolOffStorage {
        uint256 coolOffPeriod;
        //SKU -> user address => block number of last purchase
        mapping(bytes32 => mapping(address => uint256)) CoolOff;
    }

    function coolOffStorage() internal pure returns (CoolOffStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function setCoolOffPeriod(uint256 coolOff) internal {
        LibCoolOffPeriod.CoolOffStorage storage ds = coolOffStorage();
        ds.coolOffPeriod = coolOff;
    }

    function getCoolOffPeriod() internal view returns (uint256 coolOffPeriod_) {
        coolOffPeriod_ = coolOffStorage().coolOffPeriod;
    }

    function verifyUserCoolOff (bytes32 sku) internal {
        LibCoolOffPeriod.CoolOffStorage storage ds = coolOffStorage();
        require(ds.CoolOff[sku][msg.sender] + ds.coolOffPeriod < block.number, "Sale: cool off period is not over");
        ds.CoolOff[sku][msg.sender] = block.number;
    }
}
