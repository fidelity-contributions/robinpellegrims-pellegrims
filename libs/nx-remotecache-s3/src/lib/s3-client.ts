import { S3 } from '@aws-sdk/client-s3';
import {
  getEnv,
  getHttpProxy,
  getHttpsProxy,
  getNoProxy,
  matchesNoProxy,
} from './util';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import {
  getDefaultRoleAssumer,
  getDefaultRoleAssumerWithWebIdentity,
} from '@aws-sdk/client-sts';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { HttpsProxyAgent } from 'hpagent';

import type { S3ClientConfig } from '@aws-sdk/client-s3/dist-types/S3Client';
import type { DefaultProviderInit } from '@aws-sdk/credential-provider-node/dist-types/defaultProvider';
import type { AwsCredentialIdentity, Provider } from '@aws-sdk/types';

const ENV_ENDPOINT = 'NXCACHE_S3_ENDPOINT';
const ENV_PROFILE = 'NXCACHE_S3_PROFILE';
const ENV_FORCE_PATH_STYLE = 'NXCACHE_S3_FORCE_PATH_STYLE';
const ENV_REGION = 'NXCACHE_S3_REGION';
const ENV_ACCESS_KEY_ID = 'NXCACHE_S3_ACCESS_KEY_ID';
const ENV_SECRET_ACCESS_KEY = 'NXCACHE_S3_SECRET_ACCESS_KEY';
const DEFAULT_S3_ENDPOINT = 'https://s3.amazonaws.com';

function getHttpAgent(): HttpsProxyAgent {
  return new HttpsProxyAgent({ proxy: getHttpProxy() as string });
}

function getHttpsAgent(): HttpsProxyAgent {
  return new HttpsProxyAgent({ proxy: getHttpsProxy() as string });
}

export const getProxyConfig = (s3Endpoint: string = DEFAULT_S3_ENDPOINT) => ({
  ...(!matchesNoProxy(s3Endpoint, getNoProxy()) &&
    (getHttpProxy() || getHttpsProxy()) && {
      requestHandler: new NodeHttpHandler({
        ...(getHttpProxy() && { httpAgent: getHttpAgent() }),
        ...(getHttpsProxy() && { httpsAgent: getHttpsAgent() }),
      }),
    }),
});

export const buildS3Client = (
  options: Pick<S3ClientConfig, 'endpoint' | 'region' | 'forcePathStyle'> &
    Pick<DefaultProviderInit, 'profile'>
) => {
  const provider = getCredentialsProvider(options);

  return new S3({
    endpoint: getEnv(ENV_ENDPOINT) ?? options.endpoint,
    region: getEnv(ENV_REGION) ?? options.region,
    credentials: provider,
    forcePathStyle:
      getEnv(ENV_FORCE_PATH_STYLE) === 'true' || options.forcePathStyle,
    ...getProxyConfig(
      getEnv(ENV_ENDPOINT) ??
        (options.endpoint as string) ??
        DEFAULT_S3_ENDPOINT
    ),
  });
};

const getCredentialsProvider = (
  options: Pick<S3ClientConfig, 'endpoint' | 'region' | 'forcePathStyle'> &
    Pick<DefaultProviderInit, 'profile'>
): AwsCredentialIdentity | Provider<AwsCredentialIdentity> => {
  const awsAccessKeyIdOverride = getEnv(ENV_ACCESS_KEY_ID);
  const awsSecretAccessKeyOverride = getEnv(ENV_SECRET_ACCESS_KEY);

  if (awsAccessKeyIdOverride?.length && awsSecretAccessKeyOverride?.length) {
    return {
      accessKeyId: awsAccessKeyIdOverride,
      secretAccessKey: awsSecretAccessKeyOverride,
    };
  } else {
    return defaultProvider({
      profile: getEnv(ENV_PROFILE) ?? options.profile,
      roleAssumerWithWebIdentity: getDefaultRoleAssumerWithWebIdentity(),
      roleAssumer: getDefaultRoleAssumer(),
    });
  }
};
