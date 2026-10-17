# Draft — entidade `MessagingIdentity`

Este arquivo registra somente a entidade aprovada para a futura especificação
de mensageria. Ele não autoriza implementação nem amplia o escopo atual.

```typescript
interface MessagingIdentity {
  id: string;
  userId: string;
  provider: MessagingProvider;
  externalUserId: string;
  conversationId: string | null;
  enabled: boolean;
  status: MessagingIdentityStatus;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

enum MessagingProvider {
  TELEGRAM = "TELEGRAM",
}

enum MessagingIdentityStatus {
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
  VERIFIED = "VERIFIED",
  REVOKED = "REVOKED",
}
```

Restrições previstas para a persistência:

- `userId` referencia `User`;
- `provider + externalUserId` deve ser único;
- `externalUserId` permanece string;
- `verifiedAt` só possui valor quando a identidade foi verificada;
- `enabled` registra a preferência de uso, enquanto `status` registra o estado
  de verificação ou revogação.
