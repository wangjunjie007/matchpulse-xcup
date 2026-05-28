#!/bin/zsh
set -euo pipefail

SERVICE="${MATCHPULSE_KEYCHAIN_SERVICE:-matchpulse-xlayer-testnet-private-key}"
ACCOUNT="${MATCHPULSE_KEYCHAIN_ACCOUNT:-deployer}"

clear
echo "MatchPulse X Layer testnet 部署私钥录入"
echo "Keychain service: ${SERVICE}"
echo "Keychain account: ${ACCOUNT}"
echo
echo "说明："
echo "- 私钥由 macOS security 工具隐藏输入，不会显示在终端，也不会写入 shell history。"
echo "- 地址备注是公开地址/备注，只写入 Keychain comment，便于后续核对。"
echo "- 输入完成后请告诉我“已完成”，我会只验证地址和 Keychain 项是否存在，不回显私钥。"
echo

read "ADDRESS?钱包地址备注（0x 开头公开地址，可空）："
if [[ -n "${ADDRESS}" && ! "${ADDRESS}" =~ '^0x[0-9a-fA-F]{40}$' ]]; then
  echo
  echo "地址备注格式不正确：需要 0x 开头的 40 字节 EVM 地址。"
  echo "按任意键关闭。"
  read -k 1
  exit 1
fi

read "NOTE?备注名称（例如 xcup deployer，可空）："

COMMENT="MatchPulse X Cup X Layer testnet deploy key"
if [[ -n "${ADDRESS}" ]]; then
  COMMENT="${COMMENT}; address=${ADDRESS}"
fi
if [[ -n "${NOTE}" ]]; then
  COMMENT="${COMMENT}; note=${NOTE}"
fi

echo
echo "下面会出现 Password 提示，请粘贴/输入私钥。输入时不回显。"
echo "建议格式：0x + 64 位十六进制私钥。"
echo

security add-generic-password \
  -U \
  -a "${ACCOUNT}" \
  -s "${SERVICE}" \
  -l "MatchPulse XLayer deployer" \
  -j "${COMMENT}" \
  -w

echo
echo "已写入 macOS Keychain。"
echo "Service: ${SERVICE}"
echo "Account: ${ACCOUNT}"
if [[ -n "${ADDRESS}" ]]; then
  echo "Address note: ${ADDRESS}"
fi
if [[ -n "${NOTE}" ]]; then
  echo "Note: ${NOTE}"
fi
echo
echo "完成后回到 Codex 告诉我：已完成"
echo "按任意键关闭终端窗口。"
read -k 1
