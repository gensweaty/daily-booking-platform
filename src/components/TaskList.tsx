import { useQuery } from "@tanstack/react-query";
import { getTasks } from "@/lib/api";
import { Task } from "@/lib/types";

export const TaskList = () => {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
  });

  if (isLoading) return <div>Loading tasks...</div>;

  return (
    <div className="space-y-4">
      {tasks?.map((task: Task) => (
        <div
          key={task.id}
          className="p-4 bg-white rounded-lg shadow border border-gray-200"
        >
          <h3 className="font-semibold">{task.title}</h3>
          {task.description && (
            <p className="text-gray-600 mt-1">{task.description}</p>
          )}
          <div className="mt-2">
            <span className={`px-2 py-1 rounded text-sm ${
              task.status === 'todo' ? 'bg-yellow-100 text-yellow-800' :
              task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
              'bg-green-100 text-green-800'
            }`}>
              {task.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};