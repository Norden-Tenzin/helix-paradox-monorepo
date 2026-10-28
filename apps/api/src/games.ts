// The games characters can come from. Every character, mod and (later) tag belongs to one.
// Adding a game: add it here, then seed its base-game row in the `mods` table so uploads can
// tell its vanilla genes from modded ones. Imported by the web app as "api/games".

export const GAMES = {
  ck3: { name: "Crusader Kings III", short: "CK3" },
} as const;

export type GameId = keyof typeof GAMES;

export const GAME_IDS = Object.keys(GAMES) as [GameId, ...GameId[]];

/** Characters shared before games were tracked are all from here. */
export const DEFAULT_GAME: GameId = "ck3";

/** The `mods` row for each game's unmodded base game. */
export const BASE_MOD = "vanilla";
