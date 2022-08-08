interface config {
    name: string;
}

interface networkConfiguration {
    [chainId: number]: config;
}

export const networkConfig: networkConfiguration = {
    4: {
        name: "rinkeby",
    },
    31337: {
        name: "hardhat",
    },
};
