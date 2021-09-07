const {artifacts, accounts} = require('hardhat');
const {BN, expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const {ZeroAddress, EmptyByte, Zero, One, Two, MaxUInt256} = require('@animoca/ethereum-contracts-core/src/constants');
const {makeFungibleCollectionId} = require('@animoca/blockchain-inventory_metadata').inventoryIds;

const {createFixtureLoader} = require('@animoca/ethereum-contracts-core/test/utils/fixture');

const voucherTotalSupply = new BN(10);
const voucherTokenValue = 100;
const voucherId = makeFungibleCollectionId(voucherTokenValue);
const tokenTotalSupply = voucherTotalSupply.muln(voucherTokenValue);

const [deployer, purchaser, tokenHolder, other] = accounts;

describe('TokenLaunchpadVouchersRedeemer', function () {
  const fixtureLoader = createFixtureLoader(accounts, web3.eth.currentProvider);
  const fixture = async function () {
    const forwarderRegistry = await artifacts.require('ForwarderRegistry').new({from: deployer});
    const universalForwarder = await artifacts.require('UniversalForwarder').new({from: deployer});
    this.token = await artifacts
      .require('ERC20Mock')
      .new([tokenHolder], [tokenTotalSupply], forwarderRegistry.address, universalForwarder.address, {from: deployer});
    this.vouchers = await artifacts.require('ERC1155InventoryBurnableMock').new({from: deployer});
    await this.vouchers.createCollection(voucherId, {from: deployer});
    await this.vouchers.safeMint(purchaser, voucherId, voucherTotalSupply, EmptyByte);
    this.redeemer = await artifacts.require('TokenLaunchpadVouchersRedeemerMock').new(this.vouchers.address, this.token.address, tokenHolder);
    await this.token.approve(this.redeemer.address, MaxUInt256, {from: tokenHolder});
  };

  beforeEach(async function () {
    await fixtureLoader(fixture, this);
  });

  describe('onERC1155Received()', function () {
    it('reverts when the contract is paused', async function () {
      await this.redeemer.pause({from: deployer});
      await expectRevert(
        this.vouchers.safeTransferFrom(purchaser, this.redeemer.address, voucherId, One, EmptyByte, {from: purchaser}),
        'Pausable: paused'
      );
    });

    it('reverts when the sender is not the registered vouchers contract', async function () {
      const vouchersOther = await artifacts.require('ERC1155InventoryBurnableMock').new({from: deployer});
      await vouchersOther.createCollection(voucherId, {from: deployer});
      await vouchersOther.safeMint(purchaser, voucherId, voucherTotalSupply, EmptyByte);
      await expectRevert(
        vouchersOther.safeTransferFrom(purchaser, this.redeemer.address, voucherId, One, EmptyByte, {from: purchaser}),
        'Redeemer: wrong sender'
      );
    });

    it('reverts when the token holder does not have enough approval', async function () {
      await this.token.approve(this.redeemer.address, Zero, {from: tokenHolder});
      await expectRevert(
        this.vouchers.safeTransferFrom(purchaser, this.redeemer.address, voucherId, One, EmptyByte, {from: purchaser}),
        'ERC20: insufficient allowance'
      );
    });

    it('reverts when the token holder does not have enough balance', async function () {
      await this.token.transfer(other, tokenTotalSupply, {from: tokenHolder});
      await expectRevert(
        this.vouchers.safeTransferFrom(purchaser, this.redeemer.address, voucherId, One, EmptyByte, {from: purchaser}),
        'ERC20: insufficient balance'
      );
    });

    describe('when successful', function () {
      const quantity = Two;
      const tokenAmount = quantity.muln(voucherTokenValue);

      beforeEach(async function () {
        this.receipt = await this.vouchers.safeTransferFrom(purchaser, this.redeemer.address, voucherId, quantity, EmptyByte, {from: purchaser});
      });

      it('transfers vouchers from the purchaser to the redeemer contract', async function () {
        await expectEvent.inTransaction(this.receipt.tx, this.vouchers, 'TransferSingle', {
          _operator: purchaser,
          _from: purchaser,
          _to: this.redeemer.address,
          _id: voucherId,
          _value: quantity,
        });
      });

      it('burns the redeemed vouchers', async function () {
        await expectEvent.inTransaction(this.receipt.tx, this.vouchers, 'TransferSingle', {
          _operator: this.redeemer.address,
          _from: this.redeemer.address,
          _to: ZeroAddress,
          _id: voucherId,
          _value: quantity,
        });
      });

      it('transfers tokens from the token holder to the purchaser', async function () {
        await expectEvent.inTransaction(this.receipt.tx, this.token, 'Transfer', {
          _from: tokenHolder,
          _to: purchaser,
          _value: tokenAmount,
        });
      });
    });
  });

  describe('onERC1155BatchReceived()', function () {
    it('reverts when the contract is paused', async function () {
      await this.redeemer.pause({from: deployer});
      await expectRevert(
        this.vouchers.safeBatchTransferFrom(purchaser, this.redeemer.address, [voucherId], [One], EmptyByte, {from: purchaser}),
        'Pausable: paused'
      );
    });

    it('reverts when the sender is not the registered vouchers contract', async function () {
      const vouchersOther = await artifacts.require('ERC1155InventoryBurnableMock').new({from: deployer});
      await vouchersOther.createCollection(voucherId, {from: deployer});
      await vouchersOther.safeMint(purchaser, voucherId, voucherTotalSupply, EmptyByte);
      await expectRevert(
        vouchersOther.safeBatchTransferFrom(purchaser, this.redeemer.address, [voucherId], [One], EmptyByte, {from: purchaser}),
        'Redeemer: wrong sender'
      );
    });

    it('reverts when the token holder does not have enough approval', async function () {
      await this.token.approve(this.redeemer.address, Zero, {from: tokenHolder});
      await expectRevert(
        this.vouchers.safeBatchTransferFrom(purchaser, this.redeemer.address, [voucherId], [One], EmptyByte, {from: purchaser}),
        'ERC20: insufficient allowance'
      );
    });

    it('reverts when the token holder does not have enough balance', async function () {
      await this.token.transfer(other, tokenTotalSupply, {from: tokenHolder});
      await expectRevert(
        this.vouchers.safeBatchTransferFrom(purchaser, this.redeemer.address, [voucherId], [One], EmptyByte, {from: purchaser}),
        'ERC20: insufficient balance'
      );
    });

    describe('when successful', function () {
      const voucherIds = [voucherId];
      const voucherTokenValues = [voucherTokenValue];
      const quantities = [Two];
      const tokenAmounts = quantities.map((quantity, index) => quantity.muln(voucherTokenValues[index]));
      const tokenAmount = tokenAmounts.reduce((acc, curr) => acc.add(curr));

      beforeEach(async function () {
        this.receipt = await this.vouchers.safeBatchTransferFrom(purchaser, this.redeemer.address, voucherIds, quantities, EmptyByte, {
          from: purchaser,
        });
      });

      it('transfers vouchers from the purchaser to the redeemer contract', async function () {
        await expectEvent.inTransaction(this.receipt.tx, this.vouchers, 'TransferBatch', {
          _operator: purchaser,
          _from: purchaser,
          _to: this.redeemer.address,
          _ids: voucherIds,
          _values: quantities,
        });
      });

      it('burns the redeemed vouchers', async function () {
        await expectEvent.inTransaction(this.receipt.tx, this.vouchers, 'TransferBatch', {
          _operator: this.redeemer.address,
          _from: this.redeemer.address,
          _to: ZeroAddress,
          _ids: voucherIds,
          _values: quantities,
        });
      });

      it('transfers tokens from the token holder to the purchaser', async function () {
        await expectEvent.inTransaction(this.receipt.tx, this.token, 'Transfer', {
          _from: tokenHolder,
          _to: purchaser,
          _value: tokenAmount,
        });
      });
    });
  });

  describe('setTokenHolder()', function () {
    it('reverts if the sender is not the contract owner', async function () {
      await expectRevert(this.redeemer.setTokenHolder(other, {from: other}), 'Ownable: not the owner');
    });

    it('sets the new token holder', async function () {
      await this.redeemer.setTokenHolder(other, {from: deployer});
      (await this.redeemer.tokenHolder()).should.be.equal(other);
    });
  });

  describe('pause()', function () {
    it('reverts when the sender is not the contract owner', async function () {
      await expectRevert(this.redeemer.pause({from: other}), 'Ownable: not the owner');
    });

    it('reverts when the contract is already paused', async function () {
      await this.redeemer.pause({from: deployer});
      await expectRevert(this.redeemer.pause({from: deployer}), 'Pausable: paused');
    });
  });

  describe('unpause()', function () {
    it('reverts when the sender is not the contract owner', async function () {
      await expectRevert(this.redeemer.unpause({from: other}), 'Ownable: not the owner');
    });

    it('reverts when the contract is not paused', async function () {
      await expectRevert(this.redeemer.unpause({from: deployer}), 'Pausable: not paused');
    });
  });
});
