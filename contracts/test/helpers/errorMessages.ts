/**
 * Helper functions to handle custom error matching in tests
 */

export interface ErrorMessageMap {
  [customError: string]: string;
}

// Map custom errors to their equivalent string error messages for test compatibility
export const ImpactProductNFTErrorMap: ErrorMessageMap = {
  NFT__TokenNotExists: "Token does not exist",
  NFT__NotVerifiedPOI: "You are not a verified POI",
  NFT__RewardsContractNotSet: "Rewards contract not set",
  NFT__TransferRestricted: "ImpactProductNFT: transfers are restricted (soulbound NFT)",
  NFT__InvalidRewardsContract: "Invalid rewards contract address",
  NFT__InvalidAddress: "Invalid address",
  NFT__AlreadyMinted: "You have already minted a token",
  NFT__NotTokenOwner: "You don't own this token",
  NFT__MaxLevelReached: "You have reached the maximum level",
  NFT__InvalidLevelRange: "Invalid impact level range",
  NFT__UserHasNoNFT: "User has no NFT",
  NFT__TransferNotAuthorized: "Transfer not authorized",
};

export const RewardManagerErrorMap: ErrorMessageMap = {
  REWARD__InvalidLevel: "Invalid level range",
  REWARD__InvalidAddress: "Invalid user address",
  REWARD__PoiNotVerified: "PoI not verified",
  REWARD__LevelAlreadyClaimed: "Level already claimed",
  REWARD__SelfReferralNotAllowed: "Self-referral not allowed",
  REWARD__ReferralAlreadyRegistered: "Referral already registered",
  REWARD__InsufficientBalance: "Insufficient balance",
  REWARD__ZeroAmount: "Amount must be greater than zero",
  REWARD__ExcessiveRewardAmount: "Impact product claim reward too high",
  REWARD__RewardDistributionFailed: "Reward distribution failed",
};

export const TokenErrorMap: ErrorMessageMap = {
  TOKEN__InvalidRewardLogicAddress: "Invalid RewardLogic address",
  TOKEN__OnlyRewardLogicCanMint: "Only RewardLogic Contract can mint",
  TOKEN__SupplyCapExceeded: "Supply cap would be exceeded",
  TOKEN__CapTooLow: "Cap cannot be less than current supply",
};

export const AccountingErrorMap: ErrorMessageMap = {
  ACCOUNTING__ReentrancyDetected: "ReentrancyGuard: reentrant call",
  ACCOUNTING__TransfersRestrictedBeforeTGE: "Transfers not allowed before TGE",
  ACCOUNTING__ZeroAmount: "Amount must be greater than 0",
  ACCOUNTING__InvalidAddress: "Invalid address",
  ACCOUNTING__InsufficientBalance: "Insufficient balance",
  ACCOUNTING__TransferFailed: "Transfer failed",
  ACCOUNTING__AddressNotWhitelisted: "Address not whitelisted",
  ACCOUNTING__NoTokensToWithdraw: "No tokens to withdraw",
};

export const StorageErrorMap: ErrorMessageMap = {
  STORAGE__TransfersRestrictedBeforeTGE: "Transfers not allowed before TGE",
  STORAGE__InvalidAddress: "Invalid address",
  STORAGE__AddressNotWhitelisted: "Address not whitelisted",
  STORAGE__ZeroAmount: "Amount must be greater than 0",
  STORAGE__ZeroDuration: "Lock duration must be greater than 0",
  STORAGE__InsufficientBalance: "Insufficient balance",
  STORAGE__InsufficientClaimableBalance: "Insufficient claimable balance",
  STORAGE__InsufficientStakedBalance: "Insufficient staked balance",
  STORAGE__NoLockedTokens: "No locked tokens",
  STORAGE__TokensStillLocked: "Tokens still locked",
};

export const LockErrorMap: ErrorMessageMap = {
  LOCK__UnlockTimeNotInFuture: "Unlock time should be in the future",
  LOCK__WithdrawalTooEarly: "You can't withdraw yet",
  LOCK__NotOwner: "You aren't the owner",
};

/**
 * Normalizes an error message by extracting the custom error type if present
 * @param error The error message to normalize
 * @returns The normalized error message
 */
export function normalizeErrorMessage(error: Error | string): string {
  const errorMsg = error instanceof Error ? error.message : error;

  // Check if this is a custom error
  const customErrorMatch = errorMsg.match(
    /reverted with custom error '([^']+)'/
  );

  if (customErrorMatch) {
    const fullCustomError = customErrorMatch[1];

    // Extract just the error type without arguments
    const errorTypeMatch = fullCustomError.match(/([A-Z_]+)[\(\[]?/);

    if (errorTypeMatch) {
      const errorType = errorTypeMatch[1];

      // Look up in all error maps
      const errorMaps = [
        ImpactProductNFTErrorMap,
        RewardManagerErrorMap,
        TokenErrorMap,
        AccountingErrorMap,
        StorageErrorMap,
        LockErrorMap,
      ];

      for (const map of errorMaps) {
        if (map[errorType]) {
          return map[errorType];
        }
      }

      // If no mapping found, return the custom error type
      return errorType;
    }
  }

  return errorMsg;
}

/**
 * Custom chai matcher for handling both string errors and custom errors
 * @param chai The chai instance
 */
export function setupErrorMatchers(chai: Chai.ChaiStatic) {
  const { Assertion } = chai;

  // Override the existing 'revertedWith' assertion
  Assertion.overwriteMethod("rejectedWith", function (_super) {
    return function (this: any, expectedError: string) {
      const promise = this._obj;

      const newPromise = promise.then(
        (value: any) => {
          // If the promise resolves, the test should fail
          return Promise.reject(
            new Error(
              "Expected promise to be rejected but it resolved with: " + value
            )
          );
        },
        (error: Error) => {
          const normalizedError = normalizeErrorMessage(error);

          // Check if the error includes the expected error message
          if (normalizedError.includes(expectedError)) {
            return Promise.resolve();
          }

          // Format a nice error message
          const errorMessage = `expected promise to be rejected with an error including '${expectedError}' but got '${normalizedError}'`;
          return Promise.reject(new Error(errorMessage));
        }
      );

      this._obj = newPromise;
      return _super.call(this, expectedError);
    };
  });
}
