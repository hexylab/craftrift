// src/config/GameBalance.ts
// ============================================================
// CraftRift バランス定数 — 全パラメータを1ファイルに集約
// ============================================================

// ------------------------------------------------------------
// Player
// ------------------------------------------------------------
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.6;
export const MOVE_SPEED = 4.3;
export const PLAYER_MAX_HP = 500;
export const RESPAWN_TIME = 5.0;
export const INVINCIBLE_TIME = 3.0;

// ------------------------------------------------------------
// Combat (CombatSystem — 将来 WeaponCombatSystem に置換)
// ------------------------------------------------------------
export const ATTACK_DAMAGE = 50;
export const ATTACK_RANGE = 5.0;
export const ATTACK_COOLDOWN = 0.5;

// ------------------------------------------------------------
// Tower
// ------------------------------------------------------------
export const TOWER_HP = 1500;
export const NEXUS_HP = 3000;
export const TOWER_ATTACK_RANGE = 15.0;
export const TOWER_ATTACK_INTERVAL = 2.0;
export const TOWER_DAMAGE = 50;

// ------------------------------------------------------------
// Minion
// ------------------------------------------------------------
export const MINION_HP = 150;
export const MINION_DAMAGE = 10;
export const MINION_ATTACK_INTERVAL = 1.0;
export const MINION_ATTACK_RANGE = 2.0;
export const MINION_MOVE_SPEED = 3.5;

// Minion wave
export const WAVE_INTERVAL = 30.0;
export const FIRST_WAVE_DELAY = 20.0;
export const WAVE_SIZE = 3;
export const SPAWN_STAGGER = 0.75;
export const BLUE_SPAWN_Z = 12;
export const RED_SPAWN_Z = 197;
export const SPAWN_X = 9.0;

// Minion AI
export const LANE_CENTER_X = 9.0;
export const DETECTION_RANGE = 12.0;
export const LEASH_RANGE = 16.0;

// ------------------------------------------------------------
// Projectile (tower homing)
// ------------------------------------------------------------
export const PROJECTILE_SPEED = 8.0;
export const PROJECTILE_RADIUS = 0.2;
export const PROJECTILE_MAX_LIFETIME = 5.0;
export const PLAYER_HIT_RADIUS = 0.3;
export const PROJECTILE_TURN_RATE = 1.5;

// ------------------------------------------------------------
// Physics
// ------------------------------------------------------------
export const GRAVITY = 32;
export const JUMP_VELOCITY = 9.0;
export const TERMINAL_VELOCITY = 78.4;

// Knockback
export const KNOCKBACK_HORIZONTAL = 3.0;
export const KNOCKBACK_VERTICAL = 2.0;
export const KNOCKBACK_FRICTION = 10.0;

// ------------------------------------------------------------
// Map / Lane
// ------------------------------------------------------------
export const LANE_X_MIN = 2;
export const LANE_X_MAX = 16;
export const LANE_Z_MIN = 2;
export const LANE_Z_MAX = 207;

// ------------------------------------------------------------
// View
// ------------------------------------------------------------
export const THIRD_PERSON_DISTANCE = 4.0;

// ------------------------------------------------------------
// Effects
// ------------------------------------------------------------
export const SCREEN_SHAKE_INTENSITY = 0.15;
export const SCREEN_SHAKE_DURATION = 0.2;
export const DAMAGE_FLASH_DURATION = 0.15;
export const FLASH_DURATION = 0.3;
export const WALK_AMPLITUDE = 0.5;
export const WALK_SPEED_FACTOR = 8.0;

// ============================================================
// 新ゲームシステムパラメータ（Issue #24〜#28 で使用）
// ============================================================

// ------------------------------------------------------------
// DROP — 素材ドロップ (Issue #24)
// ------------------------------------------------------------
export const DROP = {
  LAST_HIT_MIN: 3,
  LAST_HIT_MAX: 5,
  PROXIMITY_MIN: 0,
  PROXIMITY_MAX: 1,
  PROXIMITY_RADIUS: 12.0,
  /** 時間帯ごとの素材ドロップ確率 [wood, stone, iron, diamond] */
  PROBABILITY_TABLE: [
    { time: 0, wood: 0.9, stone: 0.08, iron: 0.02, diamond: 0.0 },
    { time: 300, wood: 0.7, stone: 0.2, iron: 0.08, diamond: 0.02 },
    { time: 600, wood: 0.5, stone: 0.28, iron: 0.17, diamond: 0.05 },
    { time: 900, wood: 0.35, stone: 0.3, iron: 0.25, diamond: 0.1 },
    { time: 1200, wood: 0.25, stone: 0.28, iron: 0.3, diamond: 0.17 },
  ],
} as const;

// ------------------------------------------------------------
// WEAPON — 武器システム (Issue #26)
// ------------------------------------------------------------
export const WEAPON_BASE = {
  FIST: { damage: 10, range: 3.0, cooldown: 0.5, arc: 0 },
  SWORD: { damage: 15, range: 4.0, cooldown: 0.6, arc: 90 },
  AXE: { damage: 25, range: 4.0, cooldown: 0.8, arc: 0 },
  SPEAR: { damage: 12, range: 6.0, cooldown: 0.7, arc: 0 },
  BOW: { damage: 15, range: 30.0, cooldown: 1.0, arc: 0 },
} as const;

export const GRADE_MULTIPLIER = {
  NONE: { damage: 1.0, attackSpeed: 1.0 },
  WOOD: { damage: 1.3, attackSpeed: 1.1 },
  STONE: { damage: 1.8, attackSpeed: 1.2 },
  IRON: { damage: 2.8, attackSpeed: 1.35 },
  DIAMOND: { damage: 4.5, attackSpeed: 1.5 },
} as const;

export const BOW_PARAMS = {
  ARROW_SPEED: 20.0,
  GRAVITY_FACTOR: 0.3,
  MAX_FLIGHT_TIME: 3.0,
} as const;

// ------------------------------------------------------------
// CRAFT — クラフトコスト (Issue #25)
// ------------------------------------------------------------
export const CRAFT_COST = {
  WEAPON: {
    WOOD: { wood: 10, stone: 0, iron: 0, diamond: 0 },
    STONE: { wood: 0, stone: 10, iron: 0, diamond: 0 },
    IRON: { wood: 0, stone: 0, iron: 10, diamond: 0 },
    DIAMOND: { wood: 0, stone: 0, iron: 0, diamond: 10 },
  },
  BLOCK: {
    WOOD: { wood: 8, stone: 0, iron: 0, diamond: 0 },
    STONE: { wood: 0, stone: 8, iron: 0, diamond: 0 },
    IRON: { wood: 0, stone: 0, iron: 8, diamond: 0 },
    DIAMOND: { wood: 0, stone: 0, iron: 0, diamond: 8 },
  },
  STACK_LIMIT: 64,
} as const;

// ------------------------------------------------------------
// BLOCK — ブロック耐久 & 設置 (Issue #23)
// ------------------------------------------------------------
export const BLOCK_DURABILITY = {
  DIRT: 1,
  WOOD: 3,
  STONE: 6,
  IRON: 10,
  DIAMOND: 15,
} as const;

export const BLOCK_PLACEMENT = {
  MAX_PLACED: 20,
} as const;

export const BLOCK_GROUND_RATIO = {
  DIRT: 0.6,
  STONE: 0.25,
  IRON: 0.12,
  DIAMOND: 0.03,
} as const;

// ------------------------------------------------------------
// MINION scaling (Issue #27)
// ------------------------------------------------------------
export const MINION_SCALING = {
  HP_PER_WAVE: 10,
  DAMAGE_PER_WAVE: 1,
  WAVE_SIZE_INCREASE_INTERVAL: 5,
  WAVE_SIZE_MAX: 6,
  DROP_BONUS_PER_WAVE: 0.5,
} as const;
