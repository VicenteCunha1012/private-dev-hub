package pt.cunha.todo

import kotlinx.serialization.Serializable

@Serializable
data class TodoList(
    val id: Int,
    val name: String,
    val color: String = "#8b5cf6",
    val icon: String = "📋",
    val position: Int = 0,
    val parentId: Int? = null,
    val createdAt: String = "",
    val taskCount: Int = 0,
    val children: List<TodoList> = emptyList()
)

@Serializable
data class CreateListRequest(
    val name: String,
    val color: String? = null,
    val icon: String? = null,
    val parentId: Int? = null
)

@Serializable
data class UpdateListRequest(
    val name: String? = null,
    val color: String? = null,
    val icon: String? = null,
    val position: Int? = null,
    val parentId: Int? = null
)

@Serializable
data class Task(
    val id: Int,
    val listId: Int? = null,
    val title: String,
    val notes: String? = null,
    val completed: Boolean = false,
    val priority: Int = 0,
    val dueDate: String? = null,
    val tags: String? = null,
    val position: Int = 0,
    val parentId: Int? = null,
    val createdAt: String = "",
    val completedAt: String? = null,
    val subtasks: List<Task> = emptyList()
)

@Serializable
data class CreateTaskRequest(
    val title: String,
    val listId: Int? = null,
    val notes: String? = null,
    val priority: Int? = null,
    val dueDate: String? = null,
    val tags: String? = null,
    val parentId: Int? = null
)

@Serializable
data class UpdateTaskRequest(
    val title: String? = null,
    val notes: String? = null,
    val completed: Boolean? = null,
    val priority: Int? = null,
    val dueDate: String? = null,
    val tags: String? = null,
    val position: Int? = null,
    val listId: Int? = null,
    val parentId: Int? = null
)

@Serializable
data class TodoConfig(
    val key: String,
    val value: String
)

@Serializable
data class ConfigMap(
    val config: Map<String, String>
)
