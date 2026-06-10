import { DotPattern } from "../magicui/dot-pattern";
import { Center, Random1619 } from "./index";

// export const NotFound = () => {
//     return (
//         <div
//             className="relative flex items-center justify-center min-h-[calc(100vh-4.5rem)] text-center px-4 sm:px-6 lg:px-8 select-none"
//         >
//             <h1 className="text-9xl text-gray-900 dark:text-gray-100">
//                 404
//                 <span className="sr-only">Not</span>
//                 <img
//                     alt="Not"
//                     className="inline-block w-40 h-40 mx-6 rounded-xl aspect-square object-cover"
//                     src="/nongzz.jpg"
//                 />
//                 Found
//             </h1>
//             <DotPattern className="fixed [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black)]" />
//         </div>
//     )
// }

export function NotFound() {
  return (
    <Center size="page-full">
      <div className="flex flex-col items-center space-y-4">
        <Random1619 />
        <span className="text-lg text-foreground">404 Not Found</span>
      </div>
    </Center>
  );
}
