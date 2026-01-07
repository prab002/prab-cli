"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoTool = void 0;
const zod_1 = require("zod");
const base_1 = require("./base");
const config_1 = require("../config");
const ui_1 = require("../ui");
/**
 * Manage todos for multi-step tasks
 */
class TodoTool extends base_1.Tool {
    constructor() {
        super(...arguments);
        this.name = 'manage_todos';
        this.description = 'Create, update, or complete todo items to track progress on multi-step tasks. Use this proactively for complex operations.';
        this.requiresConfirmation = false;
        this.destructive = false;
        this.schema = zod_1.z.object({
            action: zod_1.z.enum(['create', 'update', 'complete', 'list', 'clear']).describe('Action to perform'),
            todos: zod_1.z.array(zod_1.z.object({
                id: zod_1.z.string().optional(),
                content: zod_1.z.string(),
                activeForm: zod_1.z.string(),
                status: zod_1.z.enum(['pending', 'in_progress', 'completed'])
            })).optional().describe('Todo items for create/update actions')
        });
    }
    async execute(params) {
        try {
            const session = (0, config_1.getSessionData)();
            let todos = session.todos || [];
            switch (params.action) {
                case 'create': {
                    if (!params.todos || params.todos.length === 0) {
                        return this.error('No todos provided for create action');
                    }
                    // Add new todos
                    const newTodos = params.todos.map(todo => ({
                        id: todo.id || `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        content: todo.content,
                        activeForm: todo.activeForm,
                        status: todo.status,
                        createdAt: Date.now()
                    }));
                    todos = [...todos, ...newTodos];
                    (0, config_1.setSessionData)({ todos });
                    (0, ui_1.showTodoList)(todos);
                    return this.success(`Created ${newTodos.length} todo(s)`, { count: newTodos.length, todos });
                }
                case 'update': {
                    if (!params.todos || params.todos.length === 0) {
                        return this.error('No todos provided for update action');
                    }
                    // Update existing todos
                    for (const update of params.todos) {
                        const index = todos.findIndex(t => t.id === update.id || t.content === update.content);
                        if (index !== -1) {
                            todos[index] = {
                                ...todos[index],
                                content: update.content,
                                activeForm: update.activeForm,
                                status: update.status
                            };
                        }
                    }
                    (0, config_1.setSessionData)({ todos });
                    (0, ui_1.showTodoList)(todos);
                    return this.success(`Updated ${params.todos.length} todo(s)`, { todos });
                }
                case 'complete': {
                    if (!params.todos || params.todos.length === 0) {
                        return this.error('No todos provided for complete action');
                    }
                    // Mark todos as completed
                    for (const completedTodo of params.todos) {
                        const index = todos.findIndex(t => t.id === completedTodo.id || t.content === completedTodo.content);
                        if (index !== -1) {
                            todos[index].status = 'completed';
                        }
                    }
                    (0, config_1.setSessionData)({ todos });
                    (0, ui_1.showTodoList)(todos);
                    return this.success(`Completed ${params.todos.length} todo(s)`, { todos });
                }
                case 'list': {
                    (0, ui_1.showTodoList)(todos);
                    const pending = todos.filter(t => t.status === 'pending').length;
                    const inProgress = todos.filter(t => t.status === 'in_progress').length;
                    const completed = todos.filter(t => t.status === 'completed').length;
                    return this.success(`Total todos: ${todos.length} (${pending} pending, ${inProgress} in progress, ${completed} completed)`, { todos, counts: { pending, inProgress, completed } });
                }
                case 'clear': {
                    (0, config_1.setSessionData)({ todos: [] });
                    return this.success('Cleared all todos');
                }
                default:
                    return this.error(`Unknown action: ${params.action}`);
            }
        }
        catch (error) {
            return this.error(`Todo management failed: ${error.message}`);
        }
    }
}
exports.TodoTool = TodoTool;
