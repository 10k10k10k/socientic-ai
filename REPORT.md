# Subagent Task Complete

I have created `src/web/liquidation.js` and implemented the `handleWithdrawal` logic.

**Features Implemented:**
- `getPortfolioHoldings`: Mocked function to simulate fetching user holdings.
- `mockContract`: Mocked smart contract interface for `agentSwap` and `withdraw`.
- `handleWithdrawal(userId, percent)`:
    - Calculates the exact amount of each token to liquidate based on the requested percentage.
    - Skips swapping if the token is already USDC.
    - Executes (mocked) `agentSwap` transactions for non-USDC tokens with basic slippage protection (1% placeholder).
    - Aggregates the total USDC proceeds.
    - Executes (mocked) `withdraw` transaction to send funds to the user.

**Verification:**
- Ran a local test script simulating a 50% withdrawal.
- Confirmed correct calculation of amounts.
- Confirmed correct sequence of "swap" then "withdraw" calls.
