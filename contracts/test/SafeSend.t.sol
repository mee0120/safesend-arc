// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeSend} from "../SafeSend.sol";

contract MockUSDC6 is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

abstract contract SafeSendTestBase is Test {
    SafeSend internal ss;
    MockUSDC6 internal usdc;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant FUND = 1_000_000e6;

    event Sent(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount, string memo);
    event Claimed(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount);
    event Cancelled(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount);
    event Verified(address indexed sender, address indexed recipient);
    event SentVerified(address indexed sender, address indexed recipient, uint256 amount, string memo);
    event VerifiedRemoved(address indexed sender, address indexed recipient);

    function setUp() public virtual {
        usdc = new MockUSDC6();
        ss = new SafeSend(IERC20(address(usdc)));
        address[4] memory users = [alice, bob, carol, stranger];
        for (uint256 i; i < users.length; ++i) {
            usdc.mint(users[i], FUND);
            vm.prank(users[i]);
            usdc.approve(address(ss), type(uint256).max);
        }
    }

    function _send(address from, address to, uint256 amount) internal returns (uint256 id) {
        vm.prank(from);
        id = ss.send(to, amount, "");
    }

    function _verify(address from, address to) internal {
        uint256 id = _send(from, to, 1e6);
        vm.prank(to);
        ss.claim(id);
    }
}

contract SafeSendTest is SafeSendTestBase {
    // ---------- (11) constructor ----------
    function test_Constructor_StoresUsdc() public view {
        assertEq(address(ss.usdc()), address(usdc));
        assertEq(ss.nextId(), 1);
        assertEq(ss.totalPending(), 0);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(SafeSend.ZeroAddress.selector);
        new SafeSend(IERC20(address(0)));
    }

    // ---------- (1) send then claim ----------
    function test_SendThenClaim() public {
        uint256 amt = 25e6;
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.expectEmit(true, true, true, true, address(ss));
        emit Sent(1, alice, bob, amt, "hi");
        vm.prank(alice);
        uint256 id = ss.send(bob, amt, "hi");
        assertEq(id, 1);
        assertEq(usdc.balanceOf(alice), aliceBefore - amt);
        assertEq(usdc.balanceOf(address(ss)), amt);
        assertEq(ss.totalPending(), amt);
        assertFalse(ss.verified(alice, bob));

        SafeSend.Transfer memory t = ss.getTransfer(id);
        assertEq(t.sender, alice);
        assertEq(t.recipient, bob);
        assertEq(t.amount, amt);
        assertEq(t.memo, "hi");
        assertEq(uint8(t.status), uint8(SafeSend.Status.Pending));

        vm.expectEmit(true, true, true, true, address(ss));
        emit Claimed(id, alice, bob, amt);
        vm.expectEmit(true, true, false, true, address(ss));
        emit Verified(alice, bob);
        vm.prank(bob);
        ss.claim(id);

        assertEq(usdc.balanceOf(bob), bobBefore + amt);
        assertEq(usdc.balanceOf(address(ss)), 0);
        assertEq(ss.totalPending(), 0);
        assertTrue(ss.verified(alice, bob));
        assertEq(uint8(ss.getTransfer(id).status), uint8(SafeSend.Status.Claimed));
    }

    // ---------- (2) send then cancel ----------
    function test_SendThenCancel() public {
        uint256 amt = 40e6;
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 id = _send(alice, bob, amt);

        vm.expectEmit(true, true, true, true, address(ss));
        emit Cancelled(id, alice, bob, amt);
        vm.prank(alice);
        ss.cancel(id);

        assertEq(usdc.balanceOf(alice), aliceBefore);
        assertEq(usdc.balanceOf(address(ss)), 0);
        assertEq(ss.totalPending(), 0);
        assertFalse(ss.verified(alice, bob));
        assertEq(uint8(ss.getTransfer(id).status), uint8(SafeSend.Status.Cancelled));
    }

    // ---------- (3) stranger ----------
    function test_Stranger_CannotClaim() public {
        uint256 id = _send(alice, bob, 10e6);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.NotRecipient.selector, id));
        ss.claim(id);
    }

    function test_Stranger_CannotCancel() public {
        uint256 id = _send(alice, bob, 10e6);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.NotSender.selector, id));
        ss.cancel(id);
    }

    // ---------- (4) wrong party ----------
    function test_Sender_CannotClaim() public {
        uint256 id = _send(alice, bob, 10e6);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.NotRecipient.selector, id));
        ss.claim(id);
    }

    function test_Recipient_CannotCancel() public {
        uint256 id = _send(alice, bob, 10e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.NotSender.selector, id));
        ss.cancel(id);
    }

    // ---------- (5) terminal states ----------
    function test_ClaimAfterCancel_Reverts() public {
        uint256 id = _send(alice, bob, 10e6);
        vm.prank(alice);
        ss.cancel(id);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.NotPending.selector, id));
        ss.claim(id);
    }

    function test_CancelAfterClaim_Reverts() public {
        uint256 id = _send(alice, bob, 10e6);
        vm.prank(bob);
        ss.claim(id);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.NotPending.selector, id));
        ss.cancel(id);
    }

    function test_DoubleClaim_Reverts() public {
        uint256 id = _send(alice, bob, 10e6);
        vm.prank(bob);
        ss.claim(id);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.NotPending.selector, id));
        ss.claim(id);
    }

    function test_DoubleCancel_Reverts() public {
        uint256 id = _send(alice, bob, 10e6);
        vm.prank(alice);
        ss.cancel(id);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.NotPending.selector, id));
        ss.cancel(id);
    }

    function test_UnknownId_ClaimAndCancelRevert() public {
        vm.expectRevert(abi.encodeWithSelector(SafeSend.NotPending.selector, 99));
        ss.claim(99);
        vm.expectRevert(abi.encodeWithSelector(SafeSend.NotPending.selector, 99));
        ss.cancel(99);
    }

    // ---------- (6) sendVerified ----------
    function test_SendVerified_RevertsIfUnverified() public {
        vm.prank(alice);
        vm.expectRevert(SafeSend.NotVerified.selector);
        ss.sendVerified(bob, 5e6, "");
    }

    function test_SendVerified_RevertsIfOnlyPendingOrCancelled() public {
        uint256 id = _send(alice, bob, 5e6);
        vm.prank(alice);
        vm.expectRevert(SafeSend.NotVerified.selector);
        ss.sendVerified(bob, 5e6, "");
        vm.prank(alice);
        ss.cancel(id);
        vm.prank(alice);
        vm.expectRevert(SafeSend.NotVerified.selector);
        ss.sendVerified(bob, 5e6, "");
    }

    function test_SendVerified_WorksAfterClaim() public {
        _verify(alice, bob);
        uint256 nextBefore = ss.nextId();
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);
        uint256 contractBefore = usdc.balanceOf(address(ss));

        vm.expectEmit(true, true, false, true, address(ss));
        emit SentVerified(alice, bob, 7e6, "direct");
        vm.prank(alice);
        ss.sendVerified(bob, 7e6, "direct");

        assertEq(usdc.balanceOf(alice), aliceBefore - 7e6);
        assertEq(usdc.balanceOf(bob), bobBefore + 7e6);
        assertEq(usdc.balanceOf(address(ss)), contractBefore);
        assertEq(ss.nextId(), nextBefore, "no new id");
        assertEq(ss.totalPending(), 0);
        assertEq(ss.pendingBySender(alice).length, 0);
        assertEq(ss.idsBySender(alice).length, 1);
    }

    function test_SendVerified_Validation() public {
        _verify(alice, bob);
        vm.startPrank(alice);
        vm.expectRevert(SafeSend.ZeroAmount.selector);
        ss.sendVerified(bob, 0, "");
        vm.expectRevert(SafeSend.MemoTooLong.selector);
        ss.sendVerified(bob, 1, _memo(65));
        vm.expectRevert(SafeSend.SelfTransfer.selector);
        ss.sendVerified(alice, 1, "");
        vm.expectRevert(SafeSend.ZeroAddress.selector);
        ss.sendVerified(address(0), 1, "");
        vm.stopPrank();
    }

    // ---------- (7) removeVerified ----------
    function test_RemoveVerified_BlocksSendVerified() public {
        _verify(alice, bob);
        vm.expectEmit(true, true, false, false, address(ss));
        emit VerifiedRemoved(alice, bob);
        vm.prank(alice);
        ss.removeVerified(bob);
        assertFalse(ss.isVerified(alice, bob));

        vm.prank(alice);
        vm.expectRevert(SafeSend.NotVerified.selector);
        ss.sendVerified(bob, 1e6, "");
    }

    function test_RemoveVerified_RevertsIfNotVerified() public {
        vm.prank(alice);
        vm.expectRevert(SafeSend.NotVerified.selector);
        ss.removeVerified(bob);
    }

    function test_RemoveVerified_TwiceReverts() public {
        _verify(alice, bob);
        vm.prank(alice);
        ss.removeVerified(bob);
        vm.prank(alice);
        vm.expectRevert(SafeSend.NotVerified.selector);
        ss.removeVerified(bob);
    }

    function test_ReclaimReverifiesAfterRemoval() public {
        _verify(alice, bob);
        vm.prank(alice);
        ss.removeVerified(bob);
        _verify(alice, bob);
        assertTrue(ss.isVerified(alice, bob));
    }

    // ---------- (9) validation ----------
    function test_Send_RevertsZeroRecipient() public {
        vm.prank(alice);
        vm.expectRevert(SafeSend.ZeroAddress.selector);
        ss.send(address(0), 1e6, "");
    }

    function test_Send_RevertsSelfRecipient() public {
        vm.prank(alice);
        vm.expectRevert(SafeSend.SelfTransfer.selector);
        ss.send(alice, 1e6, "");
    }

    function test_Send_RevertsZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(SafeSend.ZeroAmount.selector);
        ss.send(bob, 0, "");
    }

    function test_Send_Memo65Reverts() public {
        vm.prank(alice);
        vm.expectRevert(SafeSend.MemoTooLong.selector);
        ss.send(bob, 1e6, _memo(65));
    }

    function test_Send_Memo64Succeeds() public {
        string memory m = _memo(64);
        vm.prank(alice);
        uint256 id = ss.send(bob, 1e6, m);
        assertEq(ss.getTransfer(id).memo, m);
    }

    function test_Send_RevertsWithoutAllowanceOrBalance() public {
        address poor = makeAddr("poor");
        vm.prank(poor);
        vm.expectRevert();
        ss.send(bob, 1e6, "");
        // failed send must not consume an id or bump totalPending
        assertEq(ss.nextId(), 1);
        assertEq(ss.totalPending(), 0);
    }

    // ---------- (12) per-sender verification ----------
    function test_Verification_IsPerSender() public {
        _verify(alice, bob);
        assertTrue(ss.isVerified(alice, bob));
        assertFalse(ss.isVerified(carol, bob));
        assertFalse(ss.isVerified(bob, alice));

        vm.prank(carol);
        vm.expectRevert(SafeSend.NotVerified.selector);
        ss.sendVerified(bob, 1e6, "");

        // alice removing does not affect carol's verification
        _verify(carol, bob);
        vm.prank(alice);
        ss.removeVerified(bob);
        assertTrue(ss.isVerified(carol, bob));
    }

    // ---------- (10) views ----------
    function test_Views_ReturnCorrectIds() public {
        uint256 id1 = _send(alice, bob, 1e6); // will be claimed
        uint256 id2 = _send(alice, carol, 2e6); // will be cancelled
        uint256 id3 = _send(alice, bob, 3e6); // pending
        uint256 id4 = _send(carol, bob, 4e6); // pending
        vm.prank(bob);
        ss.claim(id1);
        vm.prank(alice);
        ss.cancel(id2);

        _assertIds(ss.pendingBySender(alice), _arr(id3));
        _assertIds(ss.claimedBySender(alice), _arr(id1));
        _assertIds(ss.cancelledBySender(alice), _arr(id2));
        _assertIds(ss.pendingBySender(carol), _arr(id4));
        _assertIds(ss.claimedBySender(carol), new uint256[](0));
        _assertIds(ss.cancelledBySender(carol), new uint256[](0));

        uint256[] memory two = new uint256[](2);
        two[0] = id3;
        two[1] = id4;
        _assertIds(ss.pendingByRecipient(bob), two);
        _assertIds(ss.claimedByRecipient(bob), _arr(id1));
        _assertIds(ss.cancelledByRecipient(bob), new uint256[](0));
        _assertIds(ss.cancelledByRecipient(carol), _arr(id2));
        _assertIds(ss.pendingByRecipient(carol), new uint256[](0));

        uint256[] memory all = new uint256[](3);
        all[0] = id1;
        all[1] = id2;
        all[2] = id3;
        _assertIds(ss.idsBySender(alice), all);
        _assertIds(ss.idsByRecipient(bob), _arr3(id1, id3, id4));
        assertEq(ss.idsBySender(stranger).length, 0);
        assertEq(ss.transferCount(), 4);

        // isVerified
        assertTrue(ss.isVerified(alice, bob));
        assertFalse(ss.isVerified(alice, carol));
        assertFalse(ss.isVerified(carol, bob));
    }

    function test_TransfersOf_PreservesOrderDuplicatesAndUnused() public {
        uint256 id1 = _send(alice, bob, 1e6);
        uint256 id2 = _send(carol, bob, 2e6);
        uint256[] memory q = new uint256[](4);
        q[0] = id2;
        q[1] = id1;
        q[2] = 99;
        q[3] = id2;
        SafeSend.Transfer[] memory r = ss.transfersOf(q);
        assertEq(r.length, 4);
        assertEq(r[0].sender, carol);
        assertEq(r[0].amount, 2e6);
        assertEq(r[1].sender, alice);
        assertEq(r[1].amount, 1e6);
        assertEq(uint8(r[2].status), uint8(SafeSend.Status.None));
        assertEq(r[2].sender, address(0));
        assertEq(r[3].sender, carol);
        assertEq(uint8(ss.getTransfer(99).status), uint8(SafeSend.Status.None));
    }

    // ---------- (8) fuzz ----------
    function testFuzz_SendClaimOrCancel_ConservesFunds(uint256 amount, bool doClaim) public {
        amount = bound(amount, 1, FUND);
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);
        uint256 id = _send(alice, bob, amount);
        assertEq(usdc.balanceOf(address(ss)), amount);
        assertEq(ss.totalPending(), amount);

        if (doClaim) {
            vm.prank(bob);
            ss.claim(id);
            assertEq(usdc.balanceOf(bob), bobBefore + amount);
            assertEq(usdc.balanceOf(alice), aliceBefore - amount);
            assertTrue(ss.verified(alice, bob));
        } else {
            vm.prank(alice);
            ss.cancel(id);
            assertEq(usdc.balanceOf(bob), bobBefore);
            assertEq(usdc.balanceOf(alice), aliceBefore);
            assertFalse(ss.verified(alice, bob));
        }
        assertEq(usdc.balanceOf(address(ss)), 0);
        assertEq(ss.totalPending(), 0);
    }

    function testFuzz_Memo_LengthBoundary(uint256 len) public {
        len = bound(len, 0, 200);
        vm.prank(alice);
        if (len > 64) vm.expectRevert(SafeSend.MemoTooLong.selector);
        ss.send(bob, 1e6, _memo(len));
    }

    function testFuzz_ManyPending_BalanceEqualsSum(uint96 a, uint96 b, uint96 c) public {
        uint256 x = bound(a, 1, 1e12);
        uint256 y = bound(b, 1, 1e12);
        uint256 z = bound(c, 1, 1e12);
        _send(alice, bob, x);
        uint256 idY = _send(bob, carol, y);
        _send(carol, alice, z);
        vm.prank(bob);
        ss.cancel(idY);
        assertEq(ss.totalPending(), x + z);
        assertEq(usdc.balanceOf(address(ss)), x + z);
    }

    // ---------- helpers ----------
    function _memo(uint256 n) internal pure returns (string memory) {
        bytes memory b = new bytes(n);
        for (uint256 i; i < n; ++i) b[i] = "a";
        return string(b);
    }

    function _arr(uint256 a) internal pure returns (uint256[] memory r) {
        r = new uint256[](1);
        r[0] = a;
    }

    function _arr3(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[] memory r) {
        r = new uint256[](3);
        r[0] = a;
        r[1] = b;
        r[2] = c;
    }

    function _assertIds(uint256[] memory got, uint256[] memory want) internal pure {
        assertEq(got.length, want.length, "ids length");
        for (uint256 i; i < got.length; ++i) {
            assertEq(got[i], want[i], "id mismatch");
        }
    }
}

// ---------------------------------------------------------------------------
// Invariant handler + test
// ---------------------------------------------------------------------------

contract SafeSendHandler is Test {
    SafeSend public ss;
    MockUSDC6 public usdc;
    address[] public actors;

    uint256 public sendCount;
    uint256 public claimCount;
    uint256 public cancelCount;

    constructor(SafeSend _ss, MockUSDC6 _usdc, address[] memory _actors) {
        ss = _ss;
        usdc = _usdc;
        actors = _actors;
    }

    function send(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        uint256 fi = fromSeed % actors.length;
        uint256 ti = toSeed % actors.length;
        if (fi == ti) ti = (ti + 1) % actors.length;
        address from = actors[fi];
        address to = actors[ti];
        amount = bound(amount, 1, 1_000e6);
        usdc.mint(from, amount);
        vm.startPrank(from);
        usdc.approve(address(ss), amount);
        ss.send(to, amount, "fuzz");
        vm.stopPrank();
        sendCount++;
    }

    function claim(uint256 idSeed) external {
        uint256 n = ss.transferCount();
        if (n == 0) return;
        uint256 id = (idSeed % n) + 1;
        SafeSend.Transfer memory t = ss.getTransfer(id);
        if (t.status != SafeSend.Status.Pending) return;
        vm.prank(t.recipient);
        ss.claim(id);
        claimCount++;
    }

    function cancel(uint256 idSeed) external {
        uint256 n = ss.transferCount();
        if (n == 0) return;
        uint256 id = (idSeed % n) + 1;
        SafeSend.Transfer memory t = ss.getTransfer(id);
        if (t.status != SafeSend.Status.Pending) return;
        vm.prank(t.sender);
        ss.cancel(id);
        cancelCount++;
    }

    function sumPending() external view returns (uint256 sum) {
        uint256 n = ss.transferCount();
        for (uint256 id = 1; id <= n; ++id) {
            SafeSend.Transfer memory t = ss.getTransfer(id);
            if (t.status == SafeSend.Status.Pending) sum += t.amount;
        }
    }
}

contract SafeSendInvariantTest is SafeSendTestBase {
    SafeSendHandler internal handler;

    function setUp() public override {
        super.setUp();
        address[] memory actors = new address[](4);
        actors[0] = alice;
        actors[1] = bob;
        actors[2] = carol;
        actors[3] = stranger;
        handler = new SafeSendHandler(ss, usdc, actors);
        targetContract(address(handler));
    }

    /// Contract USDC balance == sum of pending transfers == totalPending.
    function invariant_BalanceEqualsSumOfPending() public view {
        uint256 sum = handler.sumPending();
        assertEq(usdc.balanceOf(address(ss)), sum, "balance != sum(pending)");
        assertEq(ss.totalPending(), sum, "totalPending != sum(pending)");
    }

    /// Every id is accounted for exactly once across the three status buckets per sender.
    function invariant_StatusBucketsPartitionIds() public view {
        address[4] memory users = [alice, bob, carol, stranger];
        for (uint256 i; i < users.length; ++i) {
            uint256 total = ss.idsBySender(users[i]).length;
            uint256 parts = ss.pendingBySender(users[i]).length + ss.claimedBySender(users[i]).length
                + ss.cancelledBySender(users[i]).length;
            assertEq(total, parts, "buckets do not partition");
        }
    }
}
