/**
 * To-Do example Smart Contract
 * @author Leo Ribeiro
 */

#include <eosiolib/eosio.hpp>

using namespace eosio;
using std::string;

class todo : public eosio::contract {
  public:
      todo(account_name self)
      :eosio::contract(self)
      {}

      void addtodo(uint64_t id, string text) {}
      void edittodo(uint64_t id, string text) {}
      void toggletodo(uint64_t id) {}

};

EOSIO_ABI( todo, (addtodo)(edittodo)(toggletodo) )
