import type { Session } from "@/lib/auth-client";

import { Center } from "@/components/common";
import { Card, CardHeader } from "@/components/ui/card";

interface AkashaModEmptyRootIdProps {
  modId: string;
  session: Session | null;
}

export function AkashaModEmptyRootId({ modId, session }: AkashaModEmptyRootIdProps) {
  if (session) {
    return (
      <Center>
        <Card>
          <CardHeader></CardHeader>
        </Card>
      </Center>
    );
  } else {
    return <></>;
  }
}
