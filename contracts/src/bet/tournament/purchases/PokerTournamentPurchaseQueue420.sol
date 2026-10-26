// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Bounded active FIFO; expired/refunded receipts unlink in O(1).
/// @dev A historical receipt count cannot make a hand barrier scan an unbounded backlog.
library PokerTournamentPurchaseQueue420 {
    struct Node {uint64 previous;uint64 next;bool present;}
    struct Queue {uint64 head;uint64 tail;uint32 length;mapping(uint64=>Node) nodes;}
    error InvalidQueue();
    function append(Queue storage q,uint64 id,uint32 capacity)internal{
        if(id==0||q.nodes[id].present||q.length>=capacity||capacity==0||capacity>576||id<=q.tail)revert InvalidQueue();
        q.nodes[id]=Node(q.tail,0,true);if(q.tail==0)q.head=id;else q.nodes[q.tail].next=id;q.tail=id;++q.length;
    }
    function remove(Queue storage q,uint64 id)internal{
        Node memory n=q.nodes[id];if(!n.present)revert InvalidQueue();
        if(n.previous==0)q.head=n.next;else q.nodes[n.previous].next=n.next;
        if(n.next==0)q.tail=n.previous;else q.nodes[n.next].previous=n.previous;
        delete q.nodes[id];--q.length;
    }
}
