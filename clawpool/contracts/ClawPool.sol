// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ClawPool is Ownable {
    using SafeERC20 for IERC20;

    address public agent;
    IERC20 public immutable usdc;

    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event AgentSwapExecuted(address indexed router, bytes data);

    modifier onlyAgent() {
        require(msg.sender == agent, "ClawPool: caller is not the agent");
        _;
    }

    constructor(address _agent, address _usdc) Ownable(msg.sender) {
        require(_agent != address(0), "ClawPool: agent cannot be zero address");
        require(_usdc != address(0), "ClawPool: usdc cannot be zero address");
        agent = _agent;
        usdc = IERC20(_usdc);
    }

    function setAgent(address _agent) external onlyOwner {
        require(_agent != address(0), "ClawPool: agent cannot be zero address");
        emit AgentUpdated(agent, _agent);
        agent = _agent;
    }

    /**
     * @notice Deposit tokens into the pool.
     * @param token The address of the token to deposit.
     * @param amount The amount to deposit.
     */
    function deposit(address token, uint256 amount) external {
        require(amount > 0, "ClawPool: amount must be greater than 0");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw USDC from the pool.
     * @param amount The amount to withdraw.
     */
    function withdraw(uint256 amount) external onlyOwner {
        require(amount > 0, "ClawPool: amount must be greater than 0");
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, address(usdc), amount);
    }

    /**
     * @notice Withdraw any token from the pool.
     * @param token The address of the token to withdraw.
     * @param amount The amount to withdraw.
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        require(amount > 0, "ClawPool: amount must be greater than 0");
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount);
    }

    /**
     * @notice Execute a swap or arbitrary call via the agent.
     * @param target The target contract address (e.g., Uniswap Router).
     * @param data The calldata to execute.
     */
    function agentSwap(address target, bytes calldata data) external onlyAgent {
        require(target != address(0), "ClawPool: target cannot be zero address");
        
        // Execute the call
        (bool success, ) = target.call(data);
        require(success, "ClawPool: swap failed");
        
        emit AgentSwapExecuted(target, data);
    }
}
