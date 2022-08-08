import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { DEVELOPMENT_CHAINS, NFT_MARKETPLACE } from "../constants/constants";
import { verify } from "../utils/verify";
import { network } from "hardhat";

const deployNftMarketPlace: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    //@ts-ignore
    const { deploy, log } = hre.deployments;
    //@ts-ignore
    const { deployer } = await hre.getNamedAccounts();
    let args: any[] = [];
    log("Deploying ", NFT_MARKETPLACE);
    const nftMarketplace = await deploy(NFT_MARKETPLACE, {
        from: deployer,
        args,
        log: true,
    });
    log("Deployed!");

    if (!DEVELOPMENT_CHAINS.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...", NFT_MARKETPLACE);
        verify(nftMarketplace.address, args);
    }
    log("-----------------------");
};

deployNftMarketPlace.tags = ["all", "nftMarketplace"];
export default deployNftMarketPlace;
