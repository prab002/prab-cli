import { z } from 'zod';
import { Tool } from './base';
import { ToolResult, TodoItem } from '../../types';
import { getSessionData, setSessionData } from '../config';
import { showTodoList } from '../ui';

/**
 * Manage todos for multi-step tasks
 */
export class TodoTool extends Tool {
    name = 'manage_todos';
    description = 'Create, update, or complete todo items to track progress on multi-step tasks. Use this proactively for complex operations.';
    requiresConfirmation = false;
    destructive = false;

    schema = z.object({
        action: z.enum(['create', 'update', 'complete', 'list', 'clear']).describe('Action to perform'),
        todos: z.array(z.object({
            id: z.string().optional(),
            content: z.string(),
            activeForm: z.string(),
            status: z.enum(['pending', 'in_progress', 'completed'])
        })).optional().describe('Todo items for create/update actions')
    });

    async execute(params: z.infer<typeof this.schema>): Promise<ToolResult> {
        try {
            const session = getSessionData();
            let todos = session.todos || [];

            switch (params.action) {
                case 'create': {
                    if (!params.todos || params.todos.length === 0) {
                        return this.error('No todos provided for create action');
                    }

                    // Add new todos
                    const newTodos: TodoItem[] = params.todos.map(todo => ({
                        id: todo.id || `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        content: todo.content,
                        activeForm: todo.activeForm,
                        status: todo.status,
                        createdAt: Date.now()
                    }));

                    todos = [...todos, ...newTodos];
                    setSessionData({ todos });

                    showTodoList(todos);
                    return this.success(
                        `Created ${newTodos.length} todo(s)`,
                        { count: newTodos.length, todos }
                    );
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

                    setSessionData({ todos });
                    showTodoList(todos);
                    return this.success(
                        `Updated ${params.todos.length} todo(s)`,
                        { todos }
                    );
                }

                case 'complete': {
                    if (!params.todos || params.todos.length === 0) {
                        return this.error('No todos provided for complete action');
                    }

                    // Mark todos as completed
                    for (const completedTodo of params.todos) {
                        const index = todos.findIndex(t =>
                            t.id === completedTodo.id || t.content === completedTodo.content
                        );
                        if (index !== -1) {
                            todos[index].status = 'completed';
                        }
                    }

                    setSessionData({ todos });
                    showTodoList(todos);
                    return this.success(
                        `Completed ${params.todos.length} todo(s)`,
                        { todos }
                    );
                }

                case 'list': {
                    showTodoList(todos);
                    const pending = todos.filter(t => t.status === 'pending').length;
                    const inProgress = todos.filter(t => t.status === 'in_progress').length;
                    const completed = todos.filter(t => t.status === 'completed').length;

                    return this.success(
                        `Total todos: ${todos.length} (${pending} pending, ${inProgress} in progress, ${completed} completed)`,
                        { todos, counts: { pending, inProgress, completed } }
                    );
                }

                case 'clear': {
                    setSessionData({ todos: [] });
                    return this.success('Cleared all todos');
                }

                default:
                    return this.error(`Unknown action: ${params.action}`);
            }
        } catch (error: any) {
            return this.error(`Todo management failed: ${error.message}`);
        }
    }
}
