import { Link } from 'react-router'
import { Flex, Text } from 'ui/src'

export function CompanyMenu() {
  return (
    <Link to="/swap" style={{ textDecoration: 'none' }} aria-label="Tokos DEX home">
      <Flex row alignItems="center" gap="$gap8" px="$spacing8" py="$spacing8" cursor="pointer">
        <img src="/tokos-icon.svg" width="28" height="28" alt="" aria-hidden="true" />
        <Flex row alignItems="baseline" gap="$gap4">
          <Text variant="subheading1" color="$neutral1" userSelect="none">
            Tokos
          </Text>
          <Text variant="body4" color="$accent1" userSelect="none">
            DEX
          </Text>
        </Flex>
      </Flex>
    </Link>
  )
}
