package pt.cunha.arcade

import kotlinx.serialization.Serializable

@Serializable
data class GameInfo(
    val id: String,
    val name: String,
    val type: String,
    val description: String,
    val icon: String
)

val GAME_CATALOG = listOf(
    GameInfo("2048-sprint", "2048 Sprint", "timed", "Merge tiles to reach 2048 in 60 seconds", "🔢"),
    GameInfo("minesweeper", "Minesweeper Blitz", "timed", "Clear the minefield as fast as you can", "💣"),
    GameInfo("memory", "Memory Match", "timed", "Find all matching pairs", "🃏"),
    GameInfo("stroop", "Color Match", "timed", "Name the color, not the word", "🎨"),
    GameInfo("tetris", "Tetris", "endless", "Stack and clear lines", "🧱"),
    GameInfo("snake", "Snake", "endless", "Eat and grow without crashing", "🐍"),
    GameInfo("connect4", "Connect 4", "endless", "Beat the AI at 4-in-a-row", "🔴"),
    GameInfo("tictactoe", "Tic-Tac-Toe", "endless", "Beat the unbeatable AI", "❌"),
    GameInfo("breakout", "Breakout", "endless", "Smash all the bricks", "🧱"),
    GameInfo("flappy", "Flappy Clone", "endless", "Fly through the pipes", "🐦"),
    GameInfo("pong", "Pong", "endless", "Beat the AI paddle", "🏓"),
    GameInfo("asteroids", "Asteroids", "endless", "Survive the asteroid field", "☄️"),
    GameInfo("frogger", "Frogger", "endless", "Cross the road safely", "🐸"),
    GameInfo("invaders", "Space Invaders", "endless", "Defend against the alien invasion", "👾"),
    GameInfo("bubbles", "Bubble Shooter", "endless", "Pop matching bubbles", "🫧"),
)
