// World state synchronization for multiplayer
import { network, MSG } from './networking.js';

class WorldSync {
  constructor() {
    this.enabled = false;
    this.onAtomMove = null;
    this.onBondAdd = null;
    this.onBondRemove = null;
    this.onChargeSet = null;
    this.onAtomAdd = null;
    this.onAtomRemove = null;
    this.onReaction = null;
    this.onWorldSync = null;
  }

  init() {
    this.enabled = true;

    const origHandler = network.onMessage;
    network.onMessage = (peerId, msgType, data) => {
      switch (msgType) {
        case MSG.ATOM_MOVE:
          if (this.onAtomMove && data) this.onAtomMove(data);
          break;
        case MSG.BOND_ADD:
          if (this.onBondAdd && data) this.onBondAdd(data);
          break;
        case MSG.BOND_REMOVE:
          if (this.onBondRemove && data) this.onBondRemove(data);
          break;
        case MSG.CHARGE_SET:
          if (this.onChargeSet && data) this.onChargeSet(data);
          break;
        case MSG.ATOM_ADD:
          if (this.onAtomAdd && data) this.onAtomAdd(data);
          break;
        case MSG.ATOM_REMOVE:
          if (this.onAtomRemove && data) this.onAtomRemove(data);
          break;
        case MSG.REACTION:
          if (this.onReaction && data) this.onReaction(data);
          break;
        case MSG.WORLD_SYNC:
          if (this.onWorldSync && data) this.onWorldSync(data);
          break;
      }
      if (origHandler) origHandler(peerId, msgType, data);
    };
  }

  broadcastAtomMove(id, pos) {
    if (!this.enabled || !network.roomId) return;
    network.broadcast(null, MSG.ATOM_MOVE, { id, x: pos.x, y: pos.y, z: pos.z });
  }

  broadcastBondAdd(bond) {
    if (!this.enabled || !network.roomId) return;
    network.broadcast(null, MSG.BOND_ADD, {
      id: bond.id,
      a: bond.a,
      b: bond.b,
      order: bond.order,
      ionic: bond.ionic,
    });
  }

  broadcastBondRemove(bondId) {
    if (!this.enabled || !network.roomId) return;
    network.broadcast(null, MSG.BOND_REMOVE, { id: bondId });
  }

  broadcastChargeSet(key, charge) {
    if (!this.enabled || !network.roomId) return;
    network.broadcast(null, MSG.CHARGE_SET, { key, charge });
  }

  broadcastAtomAdd(atom) {
    if (!this.enabled || !network.roomId) return;
    network.broadcast(null, MSG.ATOM_ADD, {
      id: atom.id,
      el: atom.el,
      x: atom.pos.x,
      y: atom.pos.y,
      z: atom.pos.z,
    });
  }

  broadcastAtomRemove(atomId) {
    if (!this.enabled || !network.roomId) return;
    network.broadcast(null, MSG.ATOM_REMOVE, { id: atomId });
  }

  broadcastReaction(rx) {
    if (!this.enabled || !network.roomId) return;
    network.broadcast(null, MSG.REACTION, {
      equation: rx.equation,
      removedAtoms: rx.removedAtoms || [],
      addedAtoms: rx.addedAtoms || [],
      removedBonds: rx.removedBonds || [],
      addedBonds: rx.addedBonds || [],
      overrides: rx.overrides || [],
    });
  }

  broadcastWorldSync(getState) {
    if (!this.enabled || !network.roomId) return;
    const state = getState();
    network.broadcast(null, MSG.WORLD_SYNC, state);
  }

  sendWorldSync(getState) {
    if (!this.enabled || !network.roomId) return;
    const state = getState();
    if (network.isHost) {
      network.broadcast(null, MSG.WORLD_SYNC, state);
    } else {
      for (const [peerId, conn] of network.connections) {
        if (conn.open) {
          conn.send([MSG.WORLD_SYNC, state]);
        }
      }
    }
  }
}

export const worldSync = new WorldSync();
