import { AliceLoader } from "../common";

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4">
      <AliceLoader />
      <span className="text-lg">Mod Not Found</span>
    </div>
  );
}
