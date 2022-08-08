import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ContractReceipt, ContractTransaction, providers } from "ethers";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { BASIC_NFT, DEVELOPMENT_CHAINS, NFT_MARKETPLACE } from "../../constants/constants";
import { BasicNft, NftMarketplace } from "../../typechain-types";

(DEVELOPMENT_CHAINS.includes(network.name) ? describe : describe.skip)(
    NFT_MARKETPLACE,
    function () {
        async function deployContract() {
            await deployments.fixture(["all"]);
            const { deployer } = await getNamedAccounts();
            const nftMarketplace: NftMarketplace = await ethers.getContract(
                NFT_MARKETPLACE,
                deployer
            );
            const basicNft: BasicNft = await ethers.getContract(BASIC_NFT, deployer);
            // Mint NFT
            const txResponse: ContractTransaction = await basicNft.mintNft();
            const txReceipt: ContractReceipt = await txResponse.wait(1);
            // Get TokenId from events
            const tokenId: string = txReceipt.events?.[0].args?.tokenId.toString();

            return { nftMarketplace, basicNft, deployer, tokenId };
        }
        async function listNft(
            nftMarketplace: NftMarketplace,
            basicNft: BasicNft,
            deployer: string,
            tokenId: string
        ) {
            //------------------------------------------------------
            await basicNft.approve(nftMarketplace.address, tokenId);
            const price: string = ethers.utils.parseEther("0.1").toString();
            const txResponse2: ContractTransaction = await nftMarketplace.listItem(
                basicNft.address,
                tokenId,
                price
            );
            const txReceipt = await txResponse2.wait(1);
            expect(txReceipt)
                .to.emit(NFT_MARKETPLACE, "ItemListed")
                .withArgs(deployer, basicNft.address, tokenId, price);
            return { price };
        }
        describe("constructor", function () {
            it("Should set correct owner", async function () {
                const { nftMarketplace, deployer } = await loadFixture(deployContract);
                const owner = await nftMarketplace.getOwner();
                expect(owner).to.equal(deployer);
            });
        });
        describe("listItem", function () {
            it("Should revert when Marketplace is not approved", async function () {
                const { nftMarketplace, basicNft, tokenId } = await loadFixture(deployContract);
                const price: string = ethers.utils.parseEther("0.1").toString();

                await expect(
                    nftMarketplace.listItem(basicNft.address, tokenId, price)
                ).to.be.revertedWithCustomError(
                    nftMarketplace,
                    "NftMarketplace__NotApprovedForMarketplace"
                );
            });
            it("Should revert when price is zero", async function () {
                const { nftMarketplace, basicNft, tokenId } = await loadFixture(deployContract);
                await basicNft.approve(nftMarketplace.address, tokenId);
                await expect(
                    nftMarketplace.listItem(basicNft.address, tokenId, 0)
                ).to.be.revertedWithCustomError(
                    nftMarketplace,
                    "NftMarketplace__PriceMustBeGreaterThanZero"
                );
            });
            it("Should revert when someone tries to list someone else's NFT for sale", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                await basicNft.approve(nftMarketplace.address, tokenId);
                const price: string = ethers.utils.parseEther("0.1").toString();
                const playerConnectedMarketplace = nftMarketplace.connect(
                    (await ethers.getSigners())[1]
                );
                await expect(playerConnectedMarketplace.listItem(basicNft.address, tokenId, price))
                    .to.be.revertedWithCustomError(
                        playerConnectedMarketplace,
                        "NftMarketplace__YouAreNotOwnerOfNFT"
                    )
                    .withArgs(basicNft.address, tokenId, deployer);
            });
            it("Should list NFT", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                await basicNft.approve(nftMarketplace.address, tokenId);
                const price: string = ethers.utils.parseEther("0.1").toString();
                const txResponse: ContractTransaction = await nftMarketplace.listItem(
                    basicNft.address,
                    tokenId,
                    price
                );
                const txReceipt: ContractReceipt = await txResponse.wait(1);
                expect(txReceipt)
                    .to.emit(nftMarketplace, "ItemListed")
                    .withArgs(deployer, basicNft.address, tokenId, price);
            });
            //First list NFT, then list the same NFT, and expect 2nd time listing transaction to revert
            it("Should revert, if NFT is already listed", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                await basicNft.approve(nftMarketplace.address, tokenId);
                const price: string = ethers.utils.parseEther("0.1").toString();
                //List NFT
                const txResponse: ContractTransaction = await nftMarketplace.listItem(
                    basicNft.address,
                    tokenId,
                    price
                );
                const txReceipt: ContractReceipt = await txResponse.wait(1);
                expect(txReceipt)
                    .to.emit(nftMarketplace, "ItemListed")
                    .withArgs(deployer, basicNft.address, tokenId, price);
                // NFT is listed
                //---------------------------------------------------------------

                //Now list The same NFT, again, we expect the transaction to revert

                await expect(nftMarketplace.listItem(basicNft.address, tokenId, price))
                    .to.be.revertedWithCustomError(
                        nftMarketplace,
                        "NftMarketplace__NftAlreadyListed"
                    )
                    .withArgs(basicNft.address, tokenId, deployer);
            });
        });

        describe("buyItem", function () {
            it("Should revert, if NFT item is not listed for sale", async function () {
                const { nftMarketplace, basicNft, tokenId } = await loadFixture(deployContract);
                await basicNft.approve(nftMarketplace.address, tokenId);
                await expect(nftMarketplace.buyItem(basicNft.address, tokenId))
                    .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NFTisNotListed")
                    .withArgs(basicNft.address, tokenId);
            });
            it("Should revert, if NFT price is more than ETH we send", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                const { price } = await listNft(nftMarketplace, basicNft, deployer, tokenId);
                //--------------------------------------------------------
                // Now try to buy it, with less than it's price
                await expect(
                    nftMarketplace.buyItem(basicNft.address, tokenId, {
                        value: ethers.utils.parseEther("0.01").toString(),
                    })
                )
                    .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__PriceNotMet")
                    .withArgs(basicNft.address, tokenId, price);
            });
            it("Should buyItem successfuly", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                const { price } = await listNft(nftMarketplace, basicNft, deployer, tokenId);
                //--------------------------------------------------------
                // Now buy NFT
                console.log("Buying....");
                const buyer = (await ethers.getSigners())[1];
                const buyerConnectedMarketplace = nftMarketplace.connect(buyer);
                const txResponse2: ContractTransaction = await buyerConnectedMarketplace.buyItem(
                    basicNft.address,
                    tokenId,
                    { value: price }
                );
                const txReceipt2: ContractReceipt = await txResponse2.wait(1);
                expect(txReceipt2)
                    .to.emit(buyerConnectedMarketplace, "ItemBought")
                    .withArgs(buyer.address, basicNft.address, tokenId, price);
                console.log("Bought NFT successfully");
            });
            it("Should clear listing, and add proceeds after NFT is bought", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                const { price } = await listNft(nftMarketplace, basicNft, deployer, tokenId);
                //--------------------------------------------------------
                // Now buy NFT
                console.log("Buying....");
                const buyer = (await ethers.getSigners())[1];
                const buyerConnectedMarketplace = nftMarketplace.connect(buyer);
                const txResponse2: ContractTransaction = await buyerConnectedMarketplace.buyItem(
                    basicNft.address,
                    tokenId,
                    {
                        value: price,
                    }
                );

                const txReceipt2: ContractReceipt = await txResponse2.wait(1);
                // We expect event
                expect(txReceipt2)
                    .to.emit(buyerConnectedMarketplace, "ItemBought")
                    .withArgs(buyer.address, basicNft.address, tokenId, price);
                //--------------------------------------------------------------
                // Now event is fired!
                expect(txReceipt2).to.changeEtherBalance(buyer, -price);
                const listing = await nftMarketplace.getListing(basicNft.address, tokenId);

                expect(listing.toString().split(",")[0]).to.hexEqual("0x0");
                expect(listing.toString().split(",")[1]).to.be.equal("0");
                expect(await basicNft.ownerOf(0)).to.be.equal(buyer.address);

                const proceeds = await nftMarketplace.getProceeds(deployer);
                expect(proceeds.toString()).to.be.equal(price);
            });
        });
        describe("cancelItem", function () {
            it("Should revert, if someone other than owner tries to cancel listing", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                await listNft(nftMarketplace, basicNft, deployer, tokenId);
                const nftMarketplaceNotOwner = nftMarketplace.connect(
                    (await ethers.getSigners())[1]
                );
                await expect(nftMarketplaceNotOwner.cancelListing(basicNft.address, tokenId))
                    .to.be.revertedWithCustomError(
                        nftMarketplace,
                        "NftMarketplace__YouAreNotOwnerOfNFT"
                    )
                    .withArgs(basicNft.address, tokenId, deployer);
            });
            it("Should cancel listing", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                await listNft(nftMarketplace, basicNft, deployer, tokenId);
                const txResponse: ContractTransaction = await nftMarketplace.cancelListing(
                    basicNft.address,
                    tokenId
                );

                const txReceipt: ContractReceipt = await txResponse.wait(1);

                expect(txReceipt)
                    .to.emit(nftMarketplace, "ItemCancelled")
                    .withArgs(deployer, basicNft.address, tokenId);
                //-----------------------------------------------------
                const listing = await nftMarketplace.getListing(basicNft.address, tokenId);

                expect(listing.toString().split(",")[0]).to.hexEqual("0x0");
                expect(listing.toString().split(",")[1]).to.be.equal("0");
            });
        });
        describe("updateListing", function () {
            it("Should revert, if NFT is not already listed", async function () {
                const { nftMarketplace, basicNft, tokenId } = await loadFixture(deployContract);
                // NFT is not listed,
                const newPrice: string = ethers.utils.parseEther("0.2").toString();
                await expect(nftMarketplace.updateListing(basicNft.address, tokenId, newPrice))
                    .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NFTisNotListed")
                    .withArgs(basicNft.address, tokenId);
            });

            it("Should revert, if someone other than owner tries to update NFT listing", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                await listNft(nftMarketplace, basicNft, deployer, tokenId);
                const nftMarketplaceNotOwner = nftMarketplace.connect(
                    (await ethers.getSigners())[1]
                );
                const newPrice: string = ethers.utils.parseEther("0.2").toString();
                await expect(
                    nftMarketplaceNotOwner.updateListing(basicNft.address, tokenId, newPrice)
                )
                    .to.be.revertedWithCustomError(
                        nftMarketplace,
                        "NftMarketplace__YouAreNotOwnerOfNFT"
                    )
                    .withArgs(basicNft.address, tokenId, deployer);
            });

            it("Should update listing", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                await listNft(nftMarketplace, basicNft, deployer, tokenId);
                const newPrice: string = ethers.utils.parseEther("0.2").toString();
                const txResponse: ContractTransaction = await nftMarketplace.updateListing(
                    basicNft.address,
                    tokenId,
                    newPrice
                );

                const txReceipt: ContractReceipt = await txResponse.wait(1);
                // First we expect the event
                expect(txReceipt)
                    .to.emit(nftMarketplace, "ItemUpdated")
                    .withArgs(deployer, basicNft.address, tokenId, newPrice);
                // Now event is fired!
                const listing = await nftMarketplace.getListing(basicNft.address, tokenId);
                expect(listing.toString().split(",")[0]).to.be.equal(deployer);
                expect(listing.toString().split(",")[1]).to.be.equal(newPrice);
            });
        });
        describe("withdrawProceeds", function () {
            it("Should revert, if there are no proceeds", async function () {
                const { nftMarketplace } = await loadFixture(deployContract);
                await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWithCustomError(
                    nftMarketplace,
                    "NftMarketplace__YouHaveNoProceeds"
                );
            });
            it("Should withdraw proceeds", async function () {
                const { nftMarketplace, basicNft, tokenId, deployer } = await loadFixture(
                    deployContract
                );
                const { price } = await listNft(nftMarketplace, basicNft, deployer, tokenId);

                //Now buy NFT
                const buyer = (await ethers.getSigners())[1];
                const nftMarketplaceBuyer = nftMarketplace.connect(buyer);

                const txResponse = await nftMarketplaceBuyer.buyItem(basicNft.address, tokenId, {
                    value: price,
                });
                const txReceipt = await txResponse.wait(1);
                // First We expect the event
                expect(txReceipt)
                    .to.emit(NFT_MARKETPLACE, "ItemBought")
                    .withArgs(deployer, basicNft.address, tokenId, price);
                // Now the event is fired!
                await expect(nftMarketplace.withdrawProceeds()).to.changeEtherBalance(
                    deployer,
                    price
                );
                const proceeds = await nftMarketplace.getProceeds(deployer);
                expect(proceeds.toString()).to.be.equal(ethers.utils.parseEther("0").toString());
            });
        });
    }
);
