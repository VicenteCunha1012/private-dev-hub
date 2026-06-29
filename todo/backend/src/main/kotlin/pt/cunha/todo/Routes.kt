package pt.cunha.todo

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Routing.configRoutes(configService: ConfigService) {
    route("/config") {
        get { call.respond(configService.getAll()) }
        post {
            val config = call.receive<Map<String, String>>()
            configService.update(config)
            call.respond(configService.getAll())
        }
        get("/export") { call.respond(configService.exportConfig()) }
        post("/import") {
            val config = call.receive<Map<String, String>>()
            configService.importConfig(config)
            call.respond(HttpStatusCode.OK, mapOf("status" to "imported"))
        }
    }
}

fun Routing.listRoutes(listService: ListService) {
    route("/lists") {
        get {
            call.respond(listService.getAll())
        }

        post {
            val req = call.receive<CreateListRequest>()
            val list = listService.create(req)
            call.respond(HttpStatusCode.Created, list)
        }

        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid list id")
            val req = call.receive<UpdateListRequest>()
            val updated = listService.update(id, req)
                ?: throw NoSuchElementException("List not found")
            call.respond(updated)
        }

        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid list id")
            if (listService.delete(id)) {
                call.respond(HttpStatusCode.NoContent)
            } else {
                throw NoSuchElementException("List not found")
            }
        }
    }
}

fun Routing.taskRoutes(taskService: TaskService) {
    route("/tasks") {
        get {
            val listId = call.request.queryParameters["listId"]?.toIntOrNull()
            val completed = call.request.queryParameters["completed"]?.toBooleanStrictOrNull()
            val search = call.request.queryParameters["search"]
            val tag = call.request.queryParameters["tag"]
            val priority = call.request.queryParameters["priority"]?.toIntOrNull()
            call.respond(taskService.getAll(listId, completed, search, tag, priority))
        }

        post {
            val req = call.receive<CreateTaskRequest>()
            val task = taskService.create(req)
            call.respond(HttpStatusCode.Created, task)
        }

        get("/tags") {
            call.respond(taskService.getTags())
        }

        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid task id")
            val req = call.receive<UpdateTaskRequest>()
            val updated = taskService.update(id, req)
                ?: throw NoSuchElementException("Task not found")
            call.respond(updated)
        }

        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid task id")
            if (taskService.delete(id)) {
                call.respond(HttpStatusCode.NoContent)
            } else {
                throw NoSuchElementException("Task not found")
            }
        }
    }
}
