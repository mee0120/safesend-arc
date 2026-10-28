// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SafeSend
/// @notice Reversible USDC payments and a sender-specific verified address book.
/// @dev Amounts use USDC's six-decimal base units. Only ordinary, non-fee-on-transfer
/// USDC is supported. No token address is hardcoded. Unsolicited token donations
/// can make the token balance exceed totalPending and cannot be recovered.
contract SafeSend is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Lifecycle of an escrowed payment; None denotes an unused ID.
    enum Status { None, Pending, Claimed, Cancelled }

    /// @notice An escrowed payment, including its original memo.
    struct Transfer {
        address sender;
        address recipient;
        uint256 amount;
        uint64 createdAt;
        Status status;
        string memo;
    }

    error ZeroAddress();
    error SelfTransfer();
    error ZeroAmount();
    error MemoTooLong();
    error NotPending(uint256 id);
    error NotRecipient(uint256 id);
    error NotSender(uint256 id);
    error NotVerified();

    event Sent(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string memo
    );
    event Claimed(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount);
    event Cancelled(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount);
    event Verified(address indexed sender, address indexed recipient);
    event SentVerified(address indexed sender, address indexed recipient, uint256 amount, string memo);
    event VerifiedRemoved(address indexed sender, address indexed recipient);

    /// @notice USDC token selected at deployment.
    IERC20 public immutable usdc;
    /// @notice Next escrow ID; IDs start at one.
    uint256 public nextId = 1;
    /// @notice Sum of the amounts of all pending escrowed payments.
    uint256 public totalPending;
    /// @notice Escrowed payments keyed by ID.
    mapping(uint256 => Transfer) public transfers;
    /// @notice Whether a recipient has claimed a payment from a particular sender.
    mapping(address => mapping(address => bool)) public verified;

    mapping(address => uint256[]) private _idsBySender;
    mapping(address => uint256[]) private _idsByRecipient;

    /// @param usdc_ Nonzero USDC token address for the target network.
    constructor(IERC20 usdc_) {
        if (address(usdc_) == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    /// @notice Escrow a payment until its recipient claims or its sender cancels.
    /// @param recipient Recipient allowed to claim the payment.
    /// @param amount Amount in USDC base units, requiring a prior token allowance.
    /// @param memo Payment memo of at most 64 bytes.
    /// @return id Newly allocated escrow ID.
    function send(address recipient, uint256 amount, string calldata memo)
        external
        nonReentrant
        returns (uint256 id)
    {
        _validatePayment(recipient, amount, memo);

        id = nextId++;
        transfers[id] = Transfer({
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            createdAt: uint64(block.timestamp),
            status: Status.Pending,
            memo: memo
        });
        _idsBySender[msg.sender].push(id);
        _idsByRecipient[recipient].push(id);
        totalPending += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Sent(id, msg.sender, recipient, amount, memo);
    }

    /// @notice Claim a pending payment and become verified for its sender.
    /// @dev Emits Verified on every successful claim, even if already verified.
    function claim(uint256 id) external nonReentrant {
        Transfer storage payment = transfers[id];
        if (payment.status != Status.Pending) revert NotPending(id);
        if (msg.sender != payment.recipient) revert NotRecipient(id);

        payment.status = Status.Claimed;
        totalPending -= payment.amount;
        verified[payment.sender][payment.recipient] = true;

        usdc.safeTransfer(payment.recipient, payment.amount);
        emit Claimed(id, payment.sender, payment.recipient, payment.amount);
        emit Verified(payment.sender, payment.recipient);
    }

    /// @notice Cancel your pending payment and recover its full amount.
    function cancel(uint256 id) external nonReentrant {
        Transfer storage payment = transfers[id];
        if (payment.status != Status.Pending) revert NotPending(id);
        if (msg.sender != payment.sender) revert NotSender(id);

        payment.status = Status.Cancelled;
        totalPending -= payment.amount;

        usdc.safeTransfer(payment.sender, payment.amount);
        emit Cancelled(id, payment.sender, payment.recipient, payment.amount);
    }

    /// @notice Pay a verified recipient directly, without escrow or a new ID.
    /// @dev This payment is not reversible and requires a prior token allowance.
    function sendVerified(address recipient, uint256 amount, string calldata memo) external nonReentrant {
        _validatePayment(recipient, amount, memo);
        if (!verified[msg.sender][recipient]) revert NotVerified();

        usdc.safeTransferFrom(msg.sender, recipient, amount);
        emit SentVerified(msg.sender, recipient, amount, memo);
    }

    /// @notice Remove a recipient from your verified address book.
    /// @dev A subsequent claim of another pending payment can verify them again.
    function removeVerified(address recipient) external nonReentrant {
        if (!verified[msg.sender][recipient]) revert NotVerified();
        verified[msg.sender][recipient] = false;
        emit VerifiedRemoved(msg.sender, recipient);
    }

    /// @notice Whether recipient is currently verified for sender.
    function isVerified(address sender, address recipient) external view returns (bool) {
        return verified[sender][recipient];
    }

    /// @notice Get a payment, or a zero-valued Transfer with status None for an unused ID.
    function getTransfer(uint256 id) external view returns (Transfer memory) {
        return transfers[id];
    }

    /// @notice Number of escrowed payments ever created, excluding direct payments.
    function transferCount() external view returns (uint256) {
        return nextId - 1;
    }

    /// @notice All escrow IDs created by sender, in creation order.
    function idsBySender(address sender) external view returns (uint256[] memory) {
        return _idsBySender[sender];
    }

    /// @notice All escrow IDs addressed to recipient, in creation order.
    function idsByRecipient(address recipient) external view returns (uint256[] memory) {
        return _idsByRecipient[recipient];
    }

    /// @notice Pending escrow IDs created by sender.
    function pendingBySender(address sender) external view returns (uint256[] memory) {
        return _filterByStatus(_idsBySender[sender], Status.Pending);
    }

    /// @notice Claimed escrow IDs created by sender.
    function claimedBySender(address sender) external view returns (uint256[] memory) {
        return _filterByStatus(_idsBySender[sender], Status.Claimed);
    }

    /// @notice Cancelled escrow IDs created by sender.
    function cancelledBySender(address sender) external view returns (uint256[] memory) {
        return _filterByStatus(_idsBySender[sender], Status.Cancelled);
    }

    /// @notice Pending escrow IDs addressed to recipient.
    function pendingByRecipient(address recipient) external view returns (uint256[] memory) {
        return _filterByStatus(_idsByRecipient[recipient], Status.Pending);
    }

    /// @notice Claimed escrow IDs addressed to recipient.
    function claimedByRecipient(address recipient) external view returns (uint256[] memory) {
        return _filterByStatus(_idsByRecipient[recipient], Status.Claimed);
    }

    /// @notice Cancelled escrow IDs addressed to recipient.
    function cancelledByRecipient(address recipient) external view returns (uint256[] memory) {
        return _filterByStatus(_idsByRecipient[recipient], Status.Cancelled);
    }

    /// @notice Get payments in the supplied ID order, preserving duplicates.
    /// @dev Unused IDs return zero-valued Transfer entries with status None.
    function transfersOf(uint256[] calldata ids) external view returns (Transfer[] memory payments) {
        payments = new Transfer[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            payments[i] = transfers[ids[i]];
        }
    }

    /// @dev Shared input validation for escrowed and direct payments.
    function _validatePayment(address recipient, uint256 amount, string calldata memo) private view {
        if (recipient == address(0)) revert ZeroAddress();
        if (recipient == msg.sender) revert SelfTransfer();
        if (amount == 0) revert ZeroAmount();
        if (bytes(memo).length > 64) revert MemoTooLong();
    }

    /// @dev Two passes return an exact-sized array without assembly; cost grows with history.
    function _filterByStatus(uint256[] storage ids, Status status)
        private
        view
        returns (uint256[] memory matching)
    {
        uint256 length = ids.length;
        uint256 count;
        for (uint256 i; i < length; ++i) {
            if (transfers[ids[i]].status == status) ++count;
        }

        matching = new uint256[](count);
        uint256 index;
        for (uint256 i; i < length; ++i) {
            uint256 id = ids[i];
            if (transfers[id].status == status) {
                matching[index++] = id;
            }
        }
    }
}
