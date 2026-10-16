##
## EPITECH PROJECT, 2026
## makefile
## File description:
## bonus: random RSA primes and PKCS#7 padding
##

NAME		=	my_pgp

SRC_DIR		=	../src

BONUS_DIR	=	src

SRC			=	$(filter-out $(SRC_DIR)/main.c, $(wildcard $(SRC_DIR)/*.c)) \
				$(wildcard $(BONUS_DIR)/*.c)

INCLUDE		=	-I../include -Iinclude

CFLAGS		=	-g3 -Wall -Wextra $(INCLUDE)

OPTIM		=	-O2

all: $(NAME)

$(NAME): $(SRC)
	gcc -o $(NAME) $(SRC) $(CFLAGS) $(OPTIM)

tests_run: $(NAME)
	sh tests/bonus_tests.sh

clean:
	rm -f *.o *~ *#
	rm -f $(BONUS_DIR)/*.o
	rm -f *.gcno *.gcda

fclean: clean
	rm -f $(NAME)

re: fclean all

.PHONY: all re clean fclean tests_run
