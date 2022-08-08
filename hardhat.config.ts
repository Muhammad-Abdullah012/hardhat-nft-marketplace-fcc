import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import "hardhat-contract-sizer";

dotenv.config();

const REPORT_GAS: boolean = process.env.REPORT_GAS === "true" ? true : false;

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    solidity: { compilers: [{ version: "0.8.9" }, { version: "0.8.7" }] },
    networks: {
        hardhat: {
            chainId: 31337,
        },
    },
    gasReporter: {
        enabled: REPORT_GAS,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    namedAccounts: {
        deployer: {
            default: 0, // here this will by default take the first account as deployer
            1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
        },
    },
    mocha: {
        timeout: 500000
    }
};

export default config;
