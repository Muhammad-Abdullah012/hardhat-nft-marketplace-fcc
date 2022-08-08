import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { BASIC_NFT, DEVELOPMENT_CHAINS } from "../constants/constants";
import { verify } from "../utils/verify";
import { network } from "hardhat";

const deployBasicNft: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    //@ts-ignore
    const { deploy, log } = hre.deployments;
    //@ts-ignore
    const { deployer } = await hre.getNamedAccounts();
    let args: any[] = [];
    log("Deploying ", BASIC_NFT);
    const basicNft = await deploy(BASIC_NFT, {
        from: deployer,
        args,
        log: true,
    });
    log("Deployed!");

    if (!DEVELOPMENT_CHAINS.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...", BASIC_NFT);
        verify(basicNft.address, args);
    }
    log("-----------------------");
};

deployBasicNft.tags = ["all", "basicNft"];
export default deployBasicNft;
