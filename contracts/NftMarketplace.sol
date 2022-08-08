// SPDX-License-Identifier: Unlisenced

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NftMarketplace__PriceMustBeGreaterThanZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__NftAlreadyListed(address nftAddress, uint256 tokenId, address owner);
error NftMarketplace__YouAreNotOwnerOfNFT(address nftAddress, uint256 tokenId, address owner);
error NftMarketplace__NFTisNotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
error NftMarketplace__YouHaveNoProceeds();
error NftMarketplace__TransferFailed();

contract NftMarketplace is ReentrancyGuard {
    /**Type Declaration */
    struct Listing {
        address seller;
        uint256 price;
    }
    //NFT contract address -> NFT TokenId -> Listing
    mapping(address => mapping(uint256 => Listing)) private s_listing;
    /// Seller address -> Earnings from selling NFTs
    mapping(address => uint256) s_proceeds;
    /**Contract owner */
    address private immutable i_owner;
    /////////////////////
    ////// Events //////
    ////////////////////
    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemCancelled(address indexed owner, address indexed nftAddress, uint256 indexed tokenI);

    event ItemUpdated(
        address indexed owner,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    /////////////////////
    ///// Modifiers /////
    ////////////////////

    modifier checkApproved(address nftAddress, uint256 tokenId) {
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketplace();
        }
        _;
    }

    modifier checkPrice(uint256 price) {
        if (price <= 0) {
            revert NftMarketplace__PriceMustBeGreaterThanZero();
        }
        _;
    }

    modifier checkAlreadyListed(
        address nftAddress,
        uint256 tokenId,
        address owner
    ) {
        // Listing memory listing = s_listing[nftAddress][tokenId];
        if (s_listing[nftAddress][tokenId].price > 0) {
            revert NftMarketplace__NftAlreadyListed(nftAddress, tokenId, owner);
        }
        _;
    }

    /**
        @param nftAddress Address of NFT contract
        @param tokenId tokenId of NFT
        @param spender Person who is calling `listItem` function to list NFT for sale. This person must be owner of NFT.
        @notice This modifier checks if then person who is selling NFT is actually the owner of NFT??
    */
    modifier checkOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (owner != spender) {
            revert NftMarketplace__YouAreNotOwnerOfNFT(nftAddress, tokenId, owner);
        }
        _;
    }

    modifier checkListed(address nftAddress, uint256 tokenId) {
        if (s_listing[nftAddress][tokenId].price <= 0) {
            revert NftMarketplace__NFTisNotListed(nftAddress, tokenId);
        }
        _;
    }

    ///////////////////////////////////////////////////////////

    /**
        @param nftAddress Address of NFT contract
        @param tokenId tokenId of NFT
        @param price Price of NFT, for selling
        @notice This functions performs all validation for listing items, listItem function
    */
    function validate(
        address caller,
        address nftAddress,
        uint256 tokenId,
        uint256 price
    )
        private
        view
        checkOwner(nftAddress, tokenId, caller)
        checkPrice(price)
        checkApproved(nftAddress, tokenId)
        checkAlreadyListed(nftAddress, tokenId, caller)
    {}

    ///////////////////////////////////////////////////////////////////////

    /////////////////////
    // Main Functions //
    ////////////////////

    constructor() {
        i_owner = msg.sender;
    }

    /**
        @param nftAddress Address of NFT contract
        @param tokenId tokenId of NFT
        @param price Price of NFT, for selling
       @notice This function lists items (NFTs) for sale 
       @notice There are two methods for listing NFTs for sale,
        1. Send NFT to marketplace, market place "holds" the NFT, then sale it.  Gas expensive
        2. Give approval to marketplace to sell NFT on behalf of actual owner, and owner owns/holds NFT.
        We're gonna use 2nd method.
    */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    ) external {
        validate(msg.sender, nftAddress, tokenId, price);
        s_listing[nftAddress][tokenId] = Listing({seller: msg.sender, price: price});
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    function buyItem(address nftAddress, uint256 tokenId)
        external
        payable
        checkListed(nftAddress, tokenId)
        nonReentrant
    {
        Listing memory listing = s_listing[nftAddress][tokenId];
        if (msg.value < listing.price) {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId, listing.price);
        }
        uint256 earnings = s_proceeds[listing.seller];
        earnings += msg.value;
        s_proceeds[listing.seller] = earnings;
        delete (s_listing[nftAddress][tokenId]);
        /// Make sure NFT is transferred,... that's why using safeTransferFrom
        IERC721(nftAddress).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemBought(msg.sender, nftAddress, tokenId, listing.price);
    }

    function cancelListing(address nftAddress, uint256 tokenId)
        external
        checkOwner(nftAddress, tokenId, msg.sender)
    {
        delete (s_listing[nftAddress][tokenId]);
        emit ItemCancelled(msg.sender, nftAddress, tokenId);
    }

    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    ) external checkOwner(nftAddress, tokenId, msg.sender) checkListed(nftAddress, tokenId) {
        s_listing[nftAddress][tokenId].price = newPrice;
        emit ItemUpdated(msg.sender, nftAddress, tokenId, newPrice);
    }

    function withdrawProceeds() external nonReentrant {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NftMarketplace__YouHaveNoProceeds();
        }

        s_proceeds[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        if (!success) {
            revert NftMarketplace__TransferFailed();
        }
    }

    /// Getter functions
    function getOwner() public view returns (address) {
        return i_owner;
    }

    function getListing(address nftAddress, uint256 tokenId)
        external
        view
        returns (Listing memory)
    {
        return s_listing[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}

// 1. Create a decentralized NFT marketplace
//     1. `listItem`: List NFTs on marketplace
//     2. `buyItem`: Buy NFT.
//     3. `cancelItem`: Cancel a listing
//     4. `updateItem`: update price
//     5. `withdrawProceeds`: withdraw payments from bought NFTs
